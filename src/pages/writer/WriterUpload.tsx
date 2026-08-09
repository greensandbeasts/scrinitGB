import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import * as pdfjs from 'pdfjs-dist';
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

import { Button } from "@/components/ui/Button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/Form";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/RadioGroup";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { Upload, FileText, XCircle, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";

import { EligibilityModal } from "@/components/writer/EligibilityModal";
import * as Lookups from "@/lib/lookups";
import { toast } from "sonner";
import { v4 as uuidv4 } from 'uuid';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

const formSchema = z.object({
  title: z.string().min(1, "Title is required."),
  logline: z.string().min(1, "Logline is required.").max(200, "Logline must be 200 characters or less."),
  synopsis: z.string().min(250, "Synopsis must be at least 250 characters.").max(1500, "Synopsis must be 1500 characters or less."),
  format: z.string().min(1, "Format is required."),
  genre: z.string().min(1, "Genre is required."),
  language: z.string().default('en'),
  secondaryGenre: z.string().optional(),
  themes: z.array(z.string()).optional(),
  primarySetting: z.string().optional(),
  timePeriod: z.string().optional(),
  country: z.string().optional(),
  targetAudience: z.string().optional(),
  budgetRange: z.string().optional(),
  tags: z.array(z.string()).optional(),
  visibility: z.enum(['private', 'community']).default('private'),
});

type PdfValidationStatus = {
  status: 'idle' | 'validating' | 'success' | 'error';
  message: string;
  pageCount?: number;
};

const WriterUpload = () => {
  const { user } = useAuth();
  const [isEligibilityModalOpen, setIsEligibilityModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfValidation, setPdfValidation] = useState<PdfValidationStatus>({ status: 'idle', message: '' });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      title: "",
      logline: "",
      synopsis: "",
      format: "",
      genre: "",
      language: "en",
      visibility: "private",
    },
  });

  const titleValue = form.watch('title');

  const normalizeText = (text: string) => {
    return text.trim().replace(/\s+/g, ' ').toLowerCase();
  };

  useEffect(() => {
    if (!pdfFile) {
      setPdfValidation({ status: 'idle', message: '' });
      return;
    }

    const validatePdf = async () => {
      setPdfValidation({ status: 'validating', message: 'Analyzing first page...' });

      try {
        const arrayBuffer = await pdfFile.arrayBuffer();
        const pdf = await pdfjs.getDocument(arrayBuffer).promise;
        const pageCount = pdf.numPages;

        if (pageCount === 0) {
          setPdfValidation({ status: 'error', message: 'This PDF has no pages.' });
          return;
        }

        const firstPage = await pdf.getPage(1);
        const textContent = await firstPage.getTextContent();
        const pageText = textContent.items.map(item => (item as any).str).join(' ');

        if (!pageText.trim()) {
          setPdfValidation({ status: 'error', message: 'Title page could not be verified. The first page appears to be blank or an image.' });
          return;
        }

        const normalizedPageText = normalizeText(pageText);
        const normalizedMetadataTitle = normalizeText(titleValue);

        if (!normalizedMetadataTitle) {
          setPdfValidation({ status: 'error', message: 'Please enter a screenplay title first.' });
          return;
        }

        if (!normalizedPageText.includes(normalizedMetadataTitle)) {
          setPdfValidation({ status: 'error', message: 'Title page does not match. The title on the first page must match the title entered above.', pageCount });
          return;
        }

        const textWithoutTitle = normalizedPageText.replace(normalizedMetadataTitle, '');
        const forbiddenPatterns = [
          /written by/i, /by/i, /story by/i,
          /\S+@\S+\.\S+/, /(?:https?:\/\/)?(?:www\.)?\S+\.\S+/,
          /copyright/i, /©/,
          /(?:\+?(\d{1,3}))?[-. (]*(\d{3})[-. )]*(\d{3})[-. ]*(\d{4})/
        ];

        if (textWithoutTitle.trim().length > 10 && forbiddenPatterns.some(pattern => pattern.test(textWithoutTitle))) {
          setPdfValidation({ status: 'error', message: 'Title page contains identifying information. The first page must contain only the screenplay title.', pageCount });
          return;
        }

        setPdfValidation({ status: 'success', message: 'Title page validated.', pageCount });

      } catch (error) {
        console.error("PDF validation error:", error);
        setPdfValidation({ status: 'error', message: 'Title page could not be verified. Please upload a properly formatted, readable screenplay PDF.' });
      }
    };

    const timeoutId = setTimeout(validatePdf, 500);
    return () => clearTimeout(timeoutId);

  }, [pdfFile, titleValue]);

  const handleFileChange = (files: FileList | null) => {
    if (files && files[0] && files[0].type === 'application/pdf') {
      setPdfFile(files[0]);
    } else {
      setPdfFile(null);
      toast.error("Invalid file type. Please upload a PDF.");
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
      toast.error("You must be logged in to submit a screenplay.");
      return;
    }
    if (!pdfFile) {
      toast.error("Please upload a screenplay PDF.");
      return;
    }
    if (values.visibility === 'community' && pdfValidation.status !== 'success') {
      toast.error("Cannot publish to community.", {
        description: "Your screenplay's title page must be validated before publishing. Please fix the errors shown.",
      });
      return;
    }

    setIsSubmitting(true);
    toast.loading("Submitting screenplay...", { id: 'submission' });

    try {
      const filePath = `${user.id}/${uuidv4()}-${pdfFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('screenplays')
        .upload(filePath, pdfFile);

      if (uploadError) throw new Error(`Storage Error: ${uploadError.message}`);

      const { data, error: insertError } = await supabase
        .from('screenplays')
        .insert([{
          ...values,
          user_id: user.id,
          pdf_path: filePath,
          page_count: pdfValidation.pageCount,
          // Convert array fields to a format Supabase understands if needed (e.g., PostgreSQL array literal)
          themes: values.themes,
          tags: values.tags,
        }])
        .select()
        .single();

      if (insertError) throw new Error(`Database Error: ${insertError.message}`);

      toast.success("Screenplay submitted successfully!", { id: 'submission' });
      form.reset();
      setPdfFile(null);
      // TODO: Redirect to screenplay detail page: /writer/screenplays/${data.id}

    } catch (error: any) {
      console.error("Submission failed:", error);
      toast.error("Submission failed.", { id: 'submission', description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const dropzoneClassName = useMemo(() => {
    let base = "border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ";
    if (pdfValidation.status === 'validating') return base + "border-blue-500 bg-blue-50 dark:bg-blue-900/20";
    if (pdfValidation.status === 'success') return base + "border-green-500 bg-green-50 dark:bg-green-900/20";
    if (pdfValidation.status === 'error') return base + "border-red-500 bg-red-50 dark:bg-red-900/20";
    return base + "border-gray-300 dark:border-gray-700 hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-gray-800/50";
  }, [pdfValidation.status]);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <EligibilityModal open={isEligibilityModalOpen} onOpenChange={setIsEligibilityModalOpen} />

      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight">Upload Screenplay</h1>
        <p className="text-muted-foreground mt-2">
          Upload a completed screenplay ready for meaningful community feedback.
        </p>
        <Button variant="link" className="p-0 h-auto text-sm" onClick={() => setIsEligibilityModalOpen(true)}>
          Is my screenplay eligible?
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>1. Screenplay Details</CardTitle>
              <CardDescription>Enter the metadata for your screenplay. Required fields are marked with an asterisk.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Title *</FormLabel>
                  <FormControl><Input placeholder="e.g., The Last House on the Left" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="logline" render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Logline *</FormLabel>
                  <FormControl><Input placeholder="A one-sentence summary of your story." {...field} /></FormControl>
                  <FormDescription className="flex justify-between">
                    <span>A compelling, concise summary of your screenplay.</span>
                    <span>{field.value.length} / 200</span>
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="synopsis" render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Short Synopsis *</FormLabel>
                  <FormControl><Textarea placeholder="Briefly summarise the story, including the central conflict and outcome." {...field} rows={6} /></FormControl>
                  <FormDescription className="flex justify-between">
                    <span>Summarize the beginning, middle, and end.</span>
                    <span>{field.value.length} / 1500</span>
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              
              <FormField control={form.control} name="format" render={({ field }) => (
                <FormItem>
                  <FormLabel>Format *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select a format" /></SelectTrigger></FormControl>
                    <SelectContent>{Lookups.FORMAT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="genre" render={({ field }) => (
                <FormItem>
                  <FormLabel>Genre *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select a genre" /></SelectTrigger></FormControl>
                    <SelectContent>{Lookups.GENRE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="language" render={({ field }) => (
                <FormItem>
                  <FormLabel>Language *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select a language" /></SelectTrigger></FormControl>
                    <SelectContent>{Lookups.LANGUAGE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="secondaryGenre" render={({ field }) => (
                <FormItem>
                  <FormLabel>Secondary Genre</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select a secondary genre" /></SelectTrigger></FormControl>
                    <SelectContent>{Lookups.GENRE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </FormItem>
              )} />
              {/* Other optional fields can be added here similarly */}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. Screenplay PDF</CardTitle>
              <CardDescription>Upload your screenplay. The first page will be checked for anonymity and title matching.</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={dropzoneClassName}
                onClick={() => document.getElementById('pdf-upload')?.click()}
                onDrop={(e) => { e.preventDefault(); handleFileChange(e.dataTransfer.files); }}
                onDragOver={(e) => e.preventDefault()}
              >
                <input type="file" id="pdf-upload" accept=".pdf" className="hidden" onChange={(e) => handleFileChange(e.target.files)} />
                {pdfFile ? (
                  <div className="flex items-center justify-center text-left gap-4">
                    <FileText className="w-10 h-10 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{pdfFile.name}</p>
                      <p className="text-sm text-muted-foreground">{(pdfFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Upload className="w-10 h-10 text-muted-foreground" />
                    <p className="font-medium">Click to upload or drag and drop</p>
                    <p className="text-sm text-muted-foreground">PDF only</p>
                  </div>
                )}
              </div>
              {pdfValidation.status !== 'idle' && (
                <Alert variant={pdfValidation.status === 'error' ? 'destructive' : pdfValidation.status === 'success' ? 'default' : 'default'} className={`mt-4 ${pdfValidation.status === 'success' ? 'border-green-500' : ''}`}>
                  {pdfValidation.status === 'validating' && <Loader2 className="h-4 w-4 animate-spin" />}
                  {pdfValidation.status === 'success' && <CheckCircle className="h-4 w-4" />}
                  {pdfValidation.status === 'error' && <AlertTriangle className="h-4 w-4" />}
                  <AlertTitle>
                    {pdfValidation.status === 'validating' && 'Validating...'}
                    {pdfValidation.status === 'success' && 'Validation Successful'}
                    {pdfValidation.status === 'error' && 'Validation Error'}
                  </AlertTitle>
                  <AlertDescription>
                    {pdfValidation.message}
                    {pdfValidation.pageCount && ` (Page count: ${pdfValidation.pageCount})`}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3. Visibility</CardTitle>
              <CardDescription>Choose who can see your screenplay.</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField control={form.control} name="visibility" render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormControl>
                    <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                      <FormItem className="flex items-center space-x-3 space-y-0 p-4 border rounded-md has-[:checked]:border-primary">
                        <FormControl><RadioGroupItem value="private" /></FormControl>
                        <FormLabel className="font-normal">
                          <span className="font-semibold">Keep Private</span>
                          <p className="text-sm text-muted-foreground">Only visible to you. You can edit freely and publish later.</p>
                        </FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0 p-4 border rounded-md has-[:checked]:border-primary">
                        <FormControl><RadioGroupItem value="community" /></FormControl>
                        <FormLabel className="font-normal">
                          <span className="font-semibold">Publish to Reader Community</span>
                          <p className="text-sm text-muted-foreground">Available to approved readers for feedback. Requires a valid title page.</p>
                        </FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <div>
            <p className="text-center text-sm text-muted-foreground">
              By submitting your screenplay, you agree to Scrinit's Content Policy.
            </p>
            <Button type="submit" disabled={isSubmitting || !pdfFile} className="w-full mt-4">
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</> : 'Submit Screenplay'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default WriterUpload;
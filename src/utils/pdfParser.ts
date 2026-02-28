import * as pdfjsLib from 'pdfjs-dist';

// Use unpkg for the worker as it's often more reliable for this package version
const PDFJS_VERSION = '5.4.624'; 
const workerUrl = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export async function extractTextFromPDF(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    
    // Create the loading task
    const loadingTask = pdfjsLib.getDocument({ 
      data: arrayBuffer,
      // Disable font faces to avoid some common errors in browser environments
      disableFontFace: true,
      // Use standard fonts if needed
      standardFontDataUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/standard_fonts/`
    });
    
    const pdf = await loadingTask.promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => 'str' in item ? item.str : '')
          .join(' ');
        fullText += `--- Página ${i} ---\n${pageText}\n\n`;
      } catch (pageError) {
        console.warn(`Erro ao ler página ${i}:`, pageError);
        fullText += `--- Página ${i} (Erro na leitura) ---\n\n`;
      }
    }

    if (!fullText.trim()) {
      throw new Error("O PDF parece estar vazio ou é uma imagem sem camada de texto (OCR).");
    }

    return fullText;
  } catch (error: any) {
    console.error("PDF Extraction Error:", error);
    if (error.name === 'PasswordException') {
      throw new Error("O arquivo PDF está protegido por senha.");
    }
    throw new Error(`Falha técnica ao extrair texto do PDF: ${error.message}`);
  }
}

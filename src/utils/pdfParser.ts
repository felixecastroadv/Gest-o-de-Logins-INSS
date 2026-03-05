import * as pdfjsLib from 'pdfjs-dist';

import * as pdfjsLib from 'pdfjs-dist';

// Use UNPKG with the classic .js worker to avoid MIME/Module issues in some environments
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;

export interface PDFContent {
  text: string;
  images: string[]; // Base64 strings for pages that need OCR/Vision
  isScanned: boolean;
}

export async function extractTextFromPDF(file: File): Promise<PDFContent> {
  if (!pdfjsLib || !pdfjsLib.getDocument) {
    throw new Error("Biblioteca PDF.js não carregada corretamente. Tente recarregar a página.");
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    
    const loadingTask = pdfjsLib.getDocument({ 
      data: arrayBuffer,
      cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`,
    });
    
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise<any>((_, reject) => 
      setTimeout(() => reject(new Error("Tempo limite de leitura do PDF excedido (30s).")), 30000)
    );

    const pdf = await Promise.race([loadingTask.promise, timeoutPromise]);
    
    let fullText = '';
    const images: string[] = [];
    let totalTextLength = 0;

    // DISABLE IMAGE RENDERING to prevent "Black Screen" crashes on complex PDFs
    // The canvas rendering on main thread can freeze the browser.
    const maxPagesToRender = 0; 

    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        const page = await pdf.getPage(i);
        
        // 1. Extract Text
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        
        if (pageText.trim()) {
          fullText += `--- Página ${i} ---\n${pageText}\n\n`;
          totalTextLength += pageText.length;
        }

        // Image rendering logic disabled for stability
        /*
        const isLowDensity = pageText.length < 100;
        if (isLowDensity && i <= maxPagesToRender) {
           // ... canvas code ...
        }
        */
      } catch (pageError) {
        console.warn(`Erro ao ler página ${i}:`, pageError);
        fullText += `\n[Erro ao ler página ${i}]\n`;
      }
    }

    const isScanned = false; // Always false since we disabled OCR

    if (!fullText.trim()) {
       return { 
         text: "AVISO: Não foi possível extrair texto deste PDF. Ele pode ser uma imagem digitalizada ou estar protegido.", 
         images: [], 
         isScanned: false 
       };
    }

    return { text: fullText, images, isScanned };

  } catch (error: any) {
    console.error("PDF Extraction Error:", error);
    if (error.name === 'PasswordException') {
      throw new Error("O arquivo PDF está protegido por senha.");
    }
    // Return a safe error message instead of throwing to prevent app crash
    return {
        text: `ERRO DE LEITURA: ${error.message || "Falha desconhecida ao processar PDF."}`,
        images: [],
        isScanned: false
    };
  }
}

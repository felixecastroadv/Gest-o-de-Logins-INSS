import * as pdfjsLib from 'pdfjs-dist';

import * as pdfjsLib from 'pdfjs-dist';

// Use specific version from CDN to ensure stability and match package.json
const PDFJS_VERSION = '3.11.174';
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

export interface PDFContent {
  text: string;
  images: string[]; // Base64 strings for pages that need OCR/Vision
  isScanned: boolean;
}

export async function extractTextFromPDF(file: File): Promise<PDFContent> {
  // Safety check for library loading
  if (!pdfjsLib || !pdfjsLib.getDocument) {
    console.error("PDF.js library not loaded correctly.");
    return {
      text: "ERRO TÉCNICO: A biblioteca de leitura de PDF não foi carregada. Tente recarregar a página.",
      images: [],
      isScanned: false
    };
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    
    const loadingTask = pdfjsLib.getDocument({ 
      data: arrayBuffer,
      cMapUrl: `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/standard_fonts/`,
    });
    
    // Timeout race to prevent infinite hanging
    const timeoutPromise = new Promise<any>((_, reject) => 
      setTimeout(() => reject(new Error("Tempo limite de leitura do PDF excedido (30s).")), 30000)
    );

    const pdf = await Promise.race([loadingTask.promise, timeoutPromise]);
    
    let fullText = '';
    const images: string[] = []; // We will no longer extract images to prevent crashes
    
    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        // CRITICAL: Yield to main thread for 50ms between pages to prevent UI freeze/Black Screen
        await new Promise(resolve => setTimeout(resolve, 50));

        const page = await pdf.getPage(i);
        
        // 1. Extract Text ONLY
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        
        if (pageText.trim()) {
          fullText += `--- Página ${i} ---\n${pageText}\n\n`;
        }
        
        // IMAGE EXTRACTION COMPLETELY DISABLED FOR STABILITY
        // Rendering canvases for 90+ page PDFs with photos is what causes the browser to crash (OOM).

      } catch (pageError) {
        console.warn(`Erro ao processar página ${i}:`, pageError);
        fullText += `\n[Erro de leitura na página ${i}]\n`;
      }
    }

    const isScanned = false;

    if (!fullText.trim()) {
       return { 
         text: "AVISO: O arquivo parece ser um PDF digitalizado (apenas imagens). Para evitar travamentos, a leitura de imagens em PDFs foi desativada. Por favor, envie as fotos/prints diretamente como arquivos de imagem (.jpg, .png).", 
         images: [], 
         isScanned: false 
       };
    }

    return { text: fullText, images, isScanned };

  } catch (error: any) {
    console.error("PDF Extraction Fatal Error:", error);
    
    // Return safe error object instead of throwing to prevent React Error Boundary (Black Screen)
    return {
        text: `ERRO DE LEITURA: ${error.message || "Falha desconhecida. O arquivo pode estar corrompido ou protegido."}`,
        images: [],
        isScanned: false
    };
  }
}

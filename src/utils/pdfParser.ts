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
    const images: string[] = [];
    
    // LIMITS & OPTIMIZATIONS
    // We process ALL pages now, but with strict memory management and yielding
    const maxPagesToRender = 100; // High limit to cover most legal docs, but prevent infinite loops
    
    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        // CRITICAL: Yield to main thread for 100ms between pages to prevent UI freeze/Black Screen
        await new Promise(resolve => setTimeout(resolve, 100));

        const page = await pdf.getPage(i);
        
        // 1. Extract Text
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        
        if (pageText.trim()) {
          fullText += `--- Página ${i} ---\n${pageText}\n\n`;
        }

        // 2. Image Rendering (Smart Mode)
        // Only render if:
        // a) We haven't hit the safety limit
        // b) The page has very little text (likely a scan/photo) OR it's a known image-heavy doc
        const isLowTextDensity = pageText.length < 50; // Heuristic for scanned pages

        if (i <= maxPagesToRender && isLowTextDensity) {
          try {
            // Use 1.0 scale - sufficient for AI vision, saves 4x memory vs 2.0
            const viewport = page.getViewport({ scale: 1.0 }); 
            
            // Skip massive pages (e.g. engineering blueprints) to avoid crash
            if (viewport.width * viewport.height > 5000000) {
               fullText += `[AVISO: Página ${i} contém uma imagem muito grande e foi pulada para evitar travamento]\n`;
               continue;
            }

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            
            if (context) {
              canvas.height = viewport.height;
              canvas.width = viewport.width;
              
              await page.render({ 
                canvasContext: context, 
                viewport: viewport 
              } as any).promise;
              
              // Aggressive compression: JPEG 0.5 (50% quality)
              // This reduces payload size significantly while keeping text readable for AI
              const base64 = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
              images.push(base64);
              
              // Explicitly clear canvas references to help GC
              canvas.width = 1;
              canvas.height = 1;
            }
          } catch (renderError) {
            console.warn(`Erro não fatal ao renderizar imagem da página ${i}:`, renderError);
          }
        }
      } catch (pageError) {
        console.warn(`Erro ao processar página ${i}:`, pageError);
        fullText += `\n[Erro de leitura na página ${i}]\n`;
      }
    }

    const isScanned = images.length > 0;

    if (!fullText.trim() && images.length === 0) {
       return { 
         text: "AVISO: O arquivo parece vazio ou protegido. Tente enviar uma foto ou print se for um documento digitalizado.", 
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

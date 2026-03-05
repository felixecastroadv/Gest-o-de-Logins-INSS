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
    
    // LIMITS FOR STABILITY
    // Only render the first 3 pages to prevent memory crashes
    const maxPagesToRender = 3; 

    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        // Yield to main thread to prevent UI freeze
        await new Promise(resolve => setTimeout(resolve, 50));

        const page = await pdf.getPage(i);
        
        // 1. Extract Text
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        
        if (pageText.trim()) {
          fullText += `--- Página ${i} ---\n${pageText}\n\n`;
        }

        // 2. Image Rendering (Safe Mode)
        // Only render if within the limit
        if (i <= maxPagesToRender) {
          try {
            // Reduced scale for performance (1.0 is standard, 1.5 was high quality)
            const viewport = page.getViewport({ scale: 1.0 }); 
            
            // Safety check for huge pages (e.g. blueprints)
            if (viewport.width * viewport.height > 4000000) {
               console.warn(`Página ${i} muito grande para renderizar, pulando imagem.`);
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
              
              // Compress to JPEG 0.6 (60% quality) to save memory
              const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
              images.push(base64);
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

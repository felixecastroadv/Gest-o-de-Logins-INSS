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
    
    const timeoutPromise = new Promise<any>((_, reject) => 
      setTimeout(() => reject(new Error("Tempo limite de leitura do PDF excedido (60s).")), 60000)
    );

    const pdf = await Promise.race([loadingTask.promise, timeoutPromise]);
    
    let fullText = '';
    const images: string[] = [];
    
    // MEMORY SAFE OCR SETTINGS
    // We limit image extraction to 20 pages to prevent Out Of Memory (OOM) crashes (Black Screen)
    // Text is still extracted from ALL pages.
    const MAX_PAGES_FOR_OCR = 20; 
    
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
        
        // 2. Extract Image (OCR for handwritten/scanned docs)
        // Only do this if the page has very little digital text AND we are under the safety limit
        const isLowTextDensity = pageText.length < 150; 

        if (isLowTextDensity && i <= MAX_PAGES_FOR_OCR) {
            try {
                // SCALE: 1.2 is a good balance. It provides enough resolution for Gemini Vision 
                // to read handwriting and small text, while keeping memory usage reasonable.
                const viewport = page.getViewport({ scale: 1.2 }); 
                
                // Safety check for abnormally large pages
                if (viewport.width * viewport.height > 5000000) {
                   fullText += `[AVISO: Imagem da página ${i} muito pesada, leitura visual ignorada para evitar travamento]\n`;
                   continue;
                }

                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d', { alpha: false }); // alpha: false saves memory
                
                if (context) {
                  canvas.height = viewport.height;
                  canvas.width = viewport.width;
                  
                  const renderTask = page.render({ 
                    canvasContext: context, 
                    viewport: viewport 
                  }).promise;
                  
                  const renderTimeout = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error("Render timeout")), 15000)
                  );
                  
                  await Promise.race([renderTask, renderTimeout]);
                  
                  // COMPRESSION: JPEG at 70% quality. 
                  // Good balance between file size and text legibility for the AI.
                  const base64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
                  images.push(base64);
                  
                  // AGGRESSIVE MEMORY CLEANUP
                  canvas.width = 0;
                  canvas.height = 0;
                  canvas.remove();
                }
            } catch (renderError) {
                console.warn(`Erro ao renderizar imagem da página ${i}:`, renderError);
            }
        } else if (isLowTextDensity && i > MAX_PAGES_FOR_OCR) {
             fullText += `[AVISO: Página ${i} parece ser uma imagem, mas o limite seguro de ${MAX_PAGES_FOR_OCR} páginas visuais foi atingido. Envie esta página separadamente se necessário.]\n`;
        }

      } catch (pageError) {
        console.warn(`Erro ao processar página ${i}:`, pageError);
        fullText += `\n[Erro de leitura na página ${i}]\n`;
      }
    }

    const isScanned = images.length > 0;

    if (!fullText.trim() && images.length === 0) {
       return { 
         text: "AVISO: Não foi possível extrair conteúdo deste arquivo.", 
         images: [], 
         isScanned: false 
       };
    }

    return { text: fullText, images, isScanned };

  } catch (error: any) {
    console.error("PDF Extraction Fatal Error:", error);
    return {
        text: `ERRO DE LEITURA: ${error.message || "Falha ao processar PDF."}`,
        images: [],
        isScanned: false
    };
  }
}

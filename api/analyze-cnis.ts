import { analyzeCNIS } from '../server/aiService';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { cnisContent } = req.body;
    if (!cnisContent) {
      return res.status(400).json({ error: 'CNIS content is required' });
    }

    const analysis = await analyzeCNIS(cnisContent);
    res.status(200).json(analysis);
  } catch (error) {
    console.error("Error in Vercel function:", error);
    res.status(500).json({ error: 'Failed to analyze CNIS' });
  }
}

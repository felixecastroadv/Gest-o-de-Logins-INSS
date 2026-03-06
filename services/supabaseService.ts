import { initSupabase } from '../supabaseClient';

const supabase = initSupabase();

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  attachments?: { name: string; url: string; type: string }[];
}

export interface ChatSession {
  id: string;
  title: string;
  date: string;
  messages: Message[];
  ai_name: 'michel' | 'luana';
}

export interface SavedCalculation {
  id: string;
  date: string;
  clientName: string;
  data: any;
}

export const supabaseService = {
  // AI Conversations
  async saveAIConversation(session: ChatSession) {
    if (!supabase) return null;
    
    const { data, error } = await supabase
      .from('ai_conversations')
      .upsert({
        id: session.id,
        ai_name: session.ai_name,
        title: session.title,
        date: session.date,
        messages: session.messages
      });
      
    if (error) {
      console.error('Error saving AI conversation to Supabase:', error);
      throw error;
    }
    return data;
  },

  async getAIConversations(aiName: 'michel' | 'luana') {
    if (!supabase) return [];
    
    const { data, error } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('ai_name', aiName)
      .order('date', { ascending: false });
      
    if (error) {
      console.error('Error fetching AI conversations from Supabase:', error);
      return [];
    }
    return data || [];
  },

  async deleteAIConversation(id: string) {
    if (!supabase) return null;
    
    const { error } = await supabase
      .from('ai_conversations')
      .delete()
      .eq('id', id);
      
    if (error) {
      console.error('Error deleting AI conversation from Supabase:', error);
      throw error;
    }
  },

  // Social Security Calculations
  async saveCalculation(calc: SavedCalculation) {
    if (!supabase) return null;
    
    const { data, error } = await supabase
      .from('social_security_calculations')
      .upsert({
        id: calc.id,
        client_name: calc.clientName,
        date: calc.date,
        data: calc.data
      });
      
    if (error) {
      console.error('Error saving calculation to Supabase:', error);
      throw error;
    }
    return data;
  },

  async getCalculations() {
    if (!supabase) return [];
    
    const { data, error } = await supabase
      .from('social_security_calculations')
      .select('*')
      .order('date', { ascending: false });
      
    if (error) {
      console.error('Error fetching calculations from Supabase:', error);
      return [];
    }
    
    return (data || []).map(item => ({
      id: item.id,
      clientName: item.client_name,
      date: item.date,
      data: item.data
    }));
  },

  async deleteCalculation(id: string) {
    if (!supabase) return null;
    
    const { error } = await supabase
      .from('social_security_calculations')
      .delete()
      .eq('id', id);
      
    if (error) {
      console.error('Error deleting calculation from Supabase:', error);
      throw error;
    }
  },

  // Labor Calculations
  async saveLaborCalculation(calc: any) {
    if (!supabase) return null;
    
    const { data, error } = await supabase
      .from('labor_calculations')
      .upsert({
        id: calc.id,
        employee_name: calc.employeeName,
        date: calc.date,
        total_value: calc.totalValue,
        data: calc.data
      });
      
    if (error) {
      console.error('Error saving labor calculation to Supabase:', error);
      throw error;
    }
    return data;
  },

  async getLaborCalculations() {
    if (!supabase) return [];
    
    const { data, error } = await supabase
      .from('labor_calculations')
      .select('*')
      .order('date', { ascending: false });
      
    if (error) {
      console.error('Error fetching labor calculations from Supabase:', error);
      return [];
    }
    
    return (data || []).map(item => ({
      id: item.id,
      employeeName: item.employee_name,
      date: item.date,
      totalValue: item.total_value || 0,
      data: item.data
    }));
  },

  async deleteLaborCalculation(id: string) {
    if (!supabase) return null;
    
    const { error } = await supabase
      .from('labor_calculations')
      .delete()
      .eq('id', id);
      
    if (error) {
      console.error('Error deleting labor calculation from Supabase:', error);
      throw error;
    }
  }
};

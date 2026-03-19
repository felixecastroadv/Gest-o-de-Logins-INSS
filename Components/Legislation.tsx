import React, { useState } from 'react';
import { MagnifyingGlassIcon, BookOpenIcon, ArrowTopRightOnSquareIcon, ArrowLeftIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

interface Law {
  id: string;
  title: string;
  description: string;
  link: string;
  category: string;
}

const INITIAL_LAWS: Law[] = [
  {
    id: 'cf88',
    title: 'Constituição Federal',
    description: 'Constituição da República Federativa do Brasil de 1988.',
    link: 'https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm',
    category: 'Constitucional'
  },
  {
    id: 'cf88-stf',
    title: 'A Constituição e o Supremo (STF)',
    description: 'Constituição Federal com anotações de jurisprudência do Supremo Tribunal Federal.',
    link: 'https://constituicao.stf.jus.br/',
    category: 'Constitucional'
  },
  {
    id: 'cc2002',
    title: 'Código Civil (Lei nº 10.406/2002)',
    description: 'Institui o Código Civil.',
    link: 'https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm',
    category: 'Civil'
  },
  {
    id: 'cpc2015',
    title: 'Código de Processo Civil (Lei nº 13.105/2015)',
    description: 'Código de Processo Civil.',
    link: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105.htm',
    category: 'Civil'
  },
  {
    id: 'clt',
    title: 'Consolidação das Leis do Trabalho (Decreto-Lei nº 5.452/1943)',
    description: 'Aprova a Consolidação das Leis do Trabalho.',
    link: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452.htm',
    category: 'Trabalhista'
  },
  {
    id: 'lei-8213',
    title: 'Lei de Benefícios da Previdência Social (Lei nº 8.213/1991)',
    description: 'Dispõe sobre os Planos de Benefícios da Previdência Social e dá outras providências.',
    link: 'https://www.planalto.gov.br/ccivil_03/leis/l8213cons.htm',
    category: 'Previdenciário'
  },
  {
    id: 'lei-8212',
    title: 'Lei Orgânica da Seguridade Social (Lei nº 8.212/1991)',
    description: 'Dispõe sobre a organização da Seguridade Social, institui Plano de Custeio, e dá outras providências.',
    link: 'https://www.planalto.gov.br/ccivil_03/leis/l8212cons.htm',
    category: 'Previdenciário'
  },
  {
    id: 'loas',
    title: 'Lei Orgânica da Assistência Social - LOAS (Lei nº 8.742/1993)',
    description: 'Dispõe sobre a organização da Assistência Social e dá outras providências.',
    link: 'https://www.planalto.gov.br/ccivil_03/leis/l8742.htm',
    category: 'Previdenciário'
  },
  {
    id: 'fgts',
    title: 'Lei do FGTS (Lei nº 8.036/1990)',
    description: 'Dispõe sobre o Fundo de Garantia do Tempo de Serviço, e dá outras providências.',
    link: 'https://www.planalto.gov.br/ccivil_03/leis/l8036.htm',
    category: 'Trabalhista'
  },
  {
    id: 'seguro-desemprego',
    title: 'Lei do Seguro-Desemprego (Lei nº 7.998/1990)',
    description: 'Regula o Programa do Seguro-Desemprego, o Abono Salarial, institui o Fundo de Amparo ao Trabalhador (FAT), e dá outras providências.',
    link: 'https://www.planalto.gov.br/ccivil_03/leis/l7998.htm',
    category: 'Trabalhista'
  },
  {
    id: 'domestico',
    title: 'Lei do Trabalho Doméstico (LC nº 150/2015)',
    description: 'Dispõe sobre o contrato de trabalho doméstico.',
    link: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp150.htm',
    category: 'Trabalhista'
  },
  {
    id: 'reforma-trabalhista',
    title: 'Reforma Trabalhista (Lei nº 13.467/2017)',
    description: 'Altera a CLT para adequar a legislação às novas relações de trabalho.',
    link: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2017/lei/l13467.htm',
    category: 'Trabalhista'
  },
  {
    id: 'ec-103',
    title: 'Reforma da Previdência (EC nº 103/2019)',
    description: 'Altera o sistema de previdência social e estabelece regras de transição e disposições transitórias.',
    link: 'https://www.planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc103.htm',
    category: 'Previdenciário'
  },
  {
    id: 'decreto-3048',
    title: 'Regulamento da Previdência Social (Decreto nº 3.048/1999)',
    description: 'Aprova o Regulamento da Previdência Social, e dá outras providências.',
    link: 'https://www.planalto.gov.br/ccivil_03/decreto/d3048.htm',
    category: 'Previdenciário'
  },
  {
    id: 'in-128',
    title: 'Instrução Normativa PRES/INSS nº 128/2022',
    description: 'Disciplina as regras, procedimentos e rotinas necessárias à efetiva aplicação das normas de direito previdenciário.',
    link: 'https://www.in.gov.br/en/web/dou/-/instrucao-normativa-pres/inss-n-128-de-28-de-marco-de-2022-389275446',
    category: 'Instruções Normativas'
  },
  {
    id: 'in-77',
    title: 'Instrução Normativa INSS/PRES nº 77/2015',
    description: 'Estabelece rotinas para agilizar e uniformizar o reconhecimento de direitos dos segurados e beneficiários da Previdência Social.',
    link: 'https://www.in.gov.br/materia/-/asset_publisher/Kujrw0TZC2Mb/content/id/32120879/do1-2015-01-22-instrucao-normativa-n-77-de-21-de-janeiro-de-2015-32120750',
    category: 'Instruções Normativas'
  }
];

const Legislation: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [selectedLaw, setSelectedLaw] = useState<Law | null>(null);
  const [iframeKey, setIframeKey] = useState(0);

  const categories = ['Todas', ...Array.from(new Set(INITIAL_LAWS.map(law => law.category)))];

  const filteredLaws = INITIAL_LAWS.filter(law => {
    const matchesSearch = law.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          law.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'Todas' || law.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (selectedLaw) {
    return (
      <div className="flex flex-col h-[calc(100vh-120px)] bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedLaw(null)}
              className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
              title="Voltar para a lista"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white line-clamp-1">
                {selectedLaw.title}
              </h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400">
                {selectedLaw.category}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIframeKey(k => k + 1)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              title="Voltar para a lei original"
            >
              <ArrowPathIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Recarregar Lei Original</span>
            </button>
            <a
              href={selectedLaw.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
              title="Abrir em nova aba"
            >
              <span className="hidden sm:inline">Abrir no navegador</span>
              <ArrowTopRightOnSquareIcon className="w-4 h-4" />
            </a>
          </div>
        </div>
        <div className="flex-1 w-full bg-white">
          <iframe
            key={iframeKey}
            src={selectedLaw.link}
            className="w-full h-full border-none"
            title={selectedLaw.title}
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BookOpenIcon className="w-6 h-6 text-primary-500" />
              Legislação e Normas
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Acesse rapidamente as principais leis, códigos e instruções normativas.
            </p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Buscar lei por nome ou descrição..."
              className="pl-10 pr-4 py-2 w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="px-4 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLaws.map((law) => (
            <button
              key={law.id}
              onClick={() => setSelectedLaw(law)}
              className="text-left block p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400">
                  {law.category}
                </span>
                <ArrowTopRightOnSquareIcon className="w-5 h-5 text-slate-400 group-hover:text-primary-500 transition-colors" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2 line-clamp-2">
                {law.title}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-3">
                {law.description}
              </p>
            </button>
          ))}
          {filteredLaws.length === 0 && (
            <div className="col-span-full text-center py-12 text-slate-500 dark:text-slate-400">
              Nenhuma lei encontrada para a sua busca.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Legislation;

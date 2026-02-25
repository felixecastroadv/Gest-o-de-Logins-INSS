import { CNISBond, SocialSecurityData } from './SocialSecurityCalc';

export interface BenefitResult {
    benefitName: string;
    isEligible: boolean;
    missingDetails?: string;
    rmi?: number;
    ruleType: 'Pre-Reform' | 'Transition' | 'Post-Reform';
    category: 'aposentadorias' | 'auxilios' | 'dependentes';
}

export interface SimulationResult {
    totalTime: { years: number, months: number, days: number, totalDays: number };
    totalCarencia: number; // months
    age: { years: number, months: number, days: number };
    points: number;
    gender: 'M' | 'F';
    isTeacher: boolean; // Simplified check
    isPcd: boolean; // Simplified check
    benefits: BenefitResult[];
}

// Helper to calculate time up to a specific date
export const calculateTimeForPeriod = (
    bonds: CNISBond[], 
    endDateStr: string, 
    gender: 'M' | 'F'
) => {
    const activeBonds = bonds.filter(b => b.useInCalculation && b.startDate);
    
    if (activeBonds.length === 0) return { years: 0, months: 0, days: 0, totalDays: 0 };

    const targetEndMs = new Date(endDateStr).setHours(12, 0, 0, 0);

    // 1. Determine Global Range
    let minDateMs = Infinity;
    let maxDateMs = -Infinity;

    const processedBonds = activeBonds.map(b => {
        const start = new Date(b.startDate);
        start.setHours(12, 0, 0, 0);
        
        // End date is the bond end date OR the target calculation date, whichever is earlier
        let bondEnd = b.endDate ? new Date(b.endDate) : new Date();
        bondEnd.setHours(12, 0, 0, 0);

        // Cap bond end at target date
        if (bondEnd.getTime() > targetEndMs) {
            bondEnd = new Date(targetEndMs);
        }

        // If bond starts after target date, it's invalid for this period
        if (start.getTime() > targetEndMs) {
            return null;
        }

        if (start.getTime() < minDateMs) minDateMs = start.getTime();
        if (bondEnd.getTime() > maxDateMs) maxDateMs = bondEnd.getTime();

        // Determine Factor
        let factor = 1.0;
        // Special Time factors only apply Pre-Reform (handled in loop)
        // But we store the potential factor here
        if (b.activityType === 'special_25') factor = gender === 'M' ? 1.4 : 1.2;
        else if (b.activityType === 'special_20') factor = gender === 'M' ? 1.75 : 1.5;
        else if (b.activityType === 'special_15') factor = gender === 'M' ? 2.33 : 2.0;

        return { startMs: start.getTime(), endMs: bondEnd.getTime(), factor, activityType: b.activityType };
    }).filter(b => b !== null && !isNaN(b.startMs) && !isNaN(b.endMs) && b.startMs <= b.endMs) as { startMs: number, endMs: number, factor: number, activityType: string }[];

    if (processedBonds.length === 0) return { years: 0, months: 0, days: 0, totalDays: 0 };

    // EC 103/2019 Reform Date (13/11/2019)
    const REFORM_DATE_MS = new Date('2019-11-13').setHours(12, 0, 0, 0);

    let totalAdjustedDays = 0;
    
    // 2. Iterate Day by Day
    let current = new Date(minDateMs);
    const maxDate = new Date(maxDateMs);
    
    // Limit to 100 years
    const MAX_LOOPS = 100 * 366; 
    let loops = 0;

    while (current <= maxDate && loops < MAX_LOOPS) {
        const currentMs = current.getTime();
        
        let maxFactorForDay = 0;
        let isActive = false;

        for (const bond of processedBonds) {
            if (currentMs >= bond.startMs && currentMs <= bond.endMs) {
                isActive = true;
                // Apply factor only if Pre-Reform (before 13/11/2019)
                // AND only if the bond type is special
                let applicableFactor = 1.0;
                if (currentMs <= REFORM_DATE_MS) {
                     applicableFactor = bond.factor;
                }
                
                if (applicableFactor > maxFactorForDay) {
                    maxFactorForDay = applicableFactor;
                }
            }
        }

        if (isActive) {
            totalAdjustedDays += maxFactorForDay;
        }

        // Next day
        current.setDate(current.getDate() + 1);
        current.setHours(12, 0, 0, 0);
        loops++;
    }

    const years = Math.floor(totalAdjustedDays / 365.25);
    const months = Math.floor((totalAdjustedDays % 365.25) / 30.44);
    const days = Math.floor((totalAdjustedDays % 365.25) % 30.44);
    
    return { years, months, days, totalDays: totalAdjustedDays };
};

export const calculateAge = (birthDateStr: string, targetDateStr: string) => {
    if (!birthDateStr) return { years: 0, months: 0, days: 0 };
    
    const birth = new Date(birthDateStr);
    const target = new Date(targetDateStr);
    
    if (isNaN(birth.getTime())) return { years: 0, months: 0, days: 0 };

    let years = target.getFullYear() - birth.getFullYear();
    let months = target.getMonth() - birth.getMonth();
    let days = target.getDate() - birth.getDate();

    if (days < 0) {
        months--;
        days += 30; // Approx
    }
    if (months < 0) {
        years--;
        months += 12;
    }
    
    return { years, months, days };
};

// --- RMI Calculation Logic ---
export const calculateRMI = (
    bonds: CNISBond[], 
    ruleType: 'Pre-Reform' | 'Post-Reform' | 'Transition_50' | 'Transition_100' | 'Disability' | 'Death',
    gender: 'M' | 'F',
    totalYears: number
) => {
    // 1. Flatten Salaries
    let allSalaries: { date: Date, value: number }[] = [];
    bonds.forEach(b => {
        if (!b.useInCalculation) return;
        b.sc.forEach(s => {
            // Parse MM/YYYY
            const [mes, ano] = s.month.split('/').map(Number);
            const date = new Date(ano, mes - 1, 1);
            
            // Filter >= July 1994
            if (date >= new Date(1994, 6, 1)) {
                allSalaries.push({ date, value: s.value });
            }
        });
    });

    if (allSalaries.length === 0) return 0;

    // Sort by value descending for Pre-Reform (80% rule)
    allSalaries.sort((a, b) => b.value - a.value);

    let average = 0;

    if (ruleType === 'Pre-Reform') {
        // Average of 80% highest
        const cutoff = Math.floor(allSalaries.length * 0.8);
        const top80 = allSalaries.slice(0, cutoff);
        const sum = top80.reduce((acc, curr) => acc + curr.value, 0);
        average = sum / (top80.length || 1);
        
        // Apply Fator Previdenciário (Simplified placeholder)
        return average; 
    } else {
        // Average of 100% (Post-Reform)
        const sum = allSalaries.reduce((acc, curr) => acc + curr.value, 0);
        average = sum / allSalaries.length;

        // Apply Coefficients
        if (ruleType === 'Transition_100') {
            return average; // 100%
        } else if (ruleType === 'Transition_50') {
            // Apply Fator Previdenciário (Placeholder)
            return average * 0.7; 
        } else if (ruleType === 'Disability') {
            // 60% + 2% > 20 (M) / 15 (F)
            let base = 0.60;
            const threshold = gender === 'M' ? 20 : 15;
            if (totalYears > threshold) {
                base += (totalYears - threshold) * 0.02;
            }
            return average * base;
        } else if (ruleType === 'Death') {
            // 50% + 10% (Assuming 1 dependent for base calc)
            return average * 0.60 * 0.60; // 60% of Retirement (which is ~60% of avg) -> Very rough approx
        } else {
            // General Rule (60% + 2% per year > 15/20)
            let base = 0.60;
            const threshold = gender === 'M' ? 20 : 15;
            if (totalYears > threshold) {
                base += (totalYears - threshold) * 0.02;
            }
            return average * base;
        }
    }
};

export const analyzeBenefits = (data: SocialSecurityData): SimulationResult => {
    const der = data.der || new Date().toISOString().split('T')[0];
    const timeTotal = calculateTimeForPeriod(data.bonds, der, data.gender);
    const age = calculateAge(data.birthDate, der);
    
    // Calculate Carência (Simplified: count unique months in bonds)
    const uniqueMonths = new Set<string>();
    data.bonds.forEach(b => {
        if (!b.useInCalculation) return;
        if (b.sc.length > 0) {
            b.sc.forEach(s => uniqueMonths.add(s.month));
        } else if (b.startDate && b.endDate) {
            let start = new Date(b.startDate);
            let end = new Date(b.endDate);
            // Limit loop to avoid crash on bad dates
            let safety = 0;
            while(start <= end && safety < 1200) { // 100 years
                uniqueMonths.add(`${start.getMonth()+1}/${start.getFullYear()}`);
                start.setMonth(start.getMonth() + 1);
                safety++;
            }
        }
    });
    const totalCarencia = uniqueMonths.size;

    const points = age.years + timeTotal.years + (timeTotal.months / 12);

    const benefits: BenefitResult[] = [];

    // --- 1. APOSENTADORIAS ---

    // 1.1 Aposentadoria por idade (Filiados até 13/11/2019)
    const ageReqOld = data.gender === 'M' ? 65 : 62;
    if (age.years >= ageReqOld && timeTotal.years >= 15 && totalCarencia >= 180) {
        benefits.push({
            benefitName: "1.1) Aposentadoria por idade (Filiados até 13/11/2019)",
            isEligible: true,
            ruleType: 'Post-Reform',
            category: 'aposentadorias',
            rmi: calculateRMI(data.bonds, 'Post-Reform', data.gender, timeTotal.years)
        });
    } else {
        benefits.push({
            benefitName: "1.1) Aposentadoria por idade (Filiados até 13/11/2019)",
            isEligible: false,
            ruleType: 'Post-Reform',
            category: 'aposentadorias',
            missingDetails: `Idade: ${age.years}/${ageReqOld}. Tempo: ${timeTotal.years}/15. Carência: ${totalCarencia}/180.`
        });
    }

    // 1.2 Aposentadoria por idade (Filiados após 13/11/2019)
    const timeReqNew = data.gender === 'M' ? 20 : 15;
    if (age.years >= 65 && timeTotal.years >= timeReqNew && totalCarencia >= 180) {
        benefits.push({
            benefitName: "1.2) Aposentadoria por idade (Filiados após 13/11/2019)",
            isEligible: true,
            ruleType: 'Post-Reform',
            category: 'aposentadorias',
            rmi: calculateRMI(data.bonds, 'Post-Reform', data.gender, timeTotal.years)
        });
    } else {
        benefits.push({
            benefitName: "1.2) Aposentadoria por idade (Filiados após 13/11/2019)",
            isEligible: false,
            ruleType: 'Post-Reform',
            category: 'aposentadorias',
            missingDetails: `Idade: ${age.years}/${data.gender === 'M' ? 65 : 62}. Tempo: ${timeTotal.years}/${timeReqNew}.`
        });
    }

    // 1.3 Aposentadoria por tempo de contribuição (Regra de Transição - Pedágio 50%)
    const timeAtReform = calculateTimeForPeriod(data.bonds, '2019-11-13', data.gender);
    const timeNeededAtReform = data.gender === 'M' ? 35 : 30;
    const missingAtReform = Math.max(0, timeNeededAtReform - timeAtReform.years);
    
    if (missingAtReform > 0 && missingAtReform <= 2) {
        const toll50 = missingAtReform * 0.5;
        const totalNeeded50 = timeNeededAtReform + toll50;
        if (timeTotal.years >= totalNeeded50 && totalCarencia >= 180) {
            benefits.push({
                benefitName: "1.3) Aposentadoria por tempo de contribuição (Regra de Transição - Pedágio 50%)",
                isEligible: true,
                ruleType: 'Transition_50',
                category: 'aposentadorias',
                rmi: calculateRMI(data.bonds, 'Transition_50', data.gender, timeTotal.years)
            });
        } else {
            benefits.push({
                benefitName: "1.3) Aposentadoria por tempo de contribuição (Regra de Transição - Pedágio 50%)",
                isEligible: false,
                ruleType: 'Transition_50',
                category: 'aposentadorias',
                missingDetails: `Tempo Total Necessário: ${totalNeeded50.toFixed(1)}. Atual: ${timeTotal.years}.`
            });
        }
    } else {
        benefits.push({
            benefitName: "1.3) Aposentadoria por tempo de contribuição (Regra de Transição - Pedágio 50%)",
            isEligible: false,
            ruleType: 'Transition_50',
            category: 'aposentadorias',
            missingDetails: missingAtReform <= 0 
                ? "Direito adquirido antes da reforma (não se aplica regra de transição)." 
                : "Faltava mais de 2 anos em 13/11/2019 (Regra inaplicável)."
        });
    }

    // 1.4 Aposentadoria por tempo de contribuição (Regra de Transição - Pedágio 100%)
    const toll100 = missingAtReform; 
    const totalNeeded100 = timeNeededAtReform + toll100;
    const ageReq100 = data.gender === 'M' ? 60 : 57;
    
    if (age.years >= ageReq100 && timeTotal.years >= totalNeeded100 && totalCarencia >= 180) {
        benefits.push({
            benefitName: "1.4) Aposentadoria por tempo de contribuição (Regra de Transição - Pedágio 100%)",
            isEligible: true,
            ruleType: 'Transition_100',
            category: 'aposentadorias',
            rmi: calculateRMI(data.bonds, 'Transition_100', data.gender, timeTotal.years)
        });
    } else {
        benefits.push({
            benefitName: "1.4) Aposentadoria por tempo de contribuição (Regra de Transição - Pedágio 100%)",
            isEligible: false,
            ruleType: 'Transition_100',
            category: 'aposentadorias',
            missingDetails: `Idade: ${age.years}/${ageReq100}. Tempo: ${timeTotal.years}/${totalNeeded100.toFixed(1)}.`
        });
    }

    // 1.5 Aposentadoria por tempo de contribuição (Regra de Transição - Idade Progressiva)
    const currentYear = new Date().getFullYear();
    const yearsSince2019 = currentYear - 2019;
    let progAgeReqM = 61 + (yearsSince2019 * 0.5);
    let progAgeReqF = 56 + (yearsSince2019 * 0.5);
    if (progAgeReqM > 65) progAgeReqM = 65;
    if (progAgeReqF > 62) progAgeReqF = 62;
    
    const progAgeReq = data.gender === 'M' ? progAgeReqM : progAgeReqF;
    const progTimeReq = data.gender === 'M' ? 35 : 30;

    if (age.years >= progAgeReq && timeTotal.years >= progTimeReq && totalCarencia >= 180) {
        benefits.push({
            benefitName: "1.5) Aposentadoria por tempo de contribuição (Regra de Transição - Idade Progressiva)",
            isEligible: true,
            ruleType: 'Post-Reform',
            category: 'aposentadorias',
            rmi: calculateRMI(data.bonds, 'Post-Reform', data.gender, timeTotal.years)
        });
    } else {
        benefits.push({
            benefitName: "1.5) Aposentadoria por tempo de contribuição (Regra de Transição - Idade Progressiva)",
            isEligible: false,
            ruleType: 'Post-Reform',
            category: 'aposentadorias',
            missingDetails: `Idade Exigida (${currentYear}): ${progAgeReq}. Atual: ${age.years}. Tempo: ${timeTotal.years}/${progTimeReq}.`
        });
    }

    // 1.6 Aposentadoria por tempo de contribuição (Regra de Transição - Pontos)
    let pointsReqM = 96 + yearsSince2019;
    let pointsReqF = 86 + yearsSince2019;
    if (pointsReqM > 105) pointsReqM = 105;
    if (pointsReqF > 100) pointsReqF = 100;
    
    const pointsReq = data.gender === 'M' ? pointsReqM : pointsReqF;
    
    if (points >= pointsReq && timeTotal.years >= progTimeReq && totalCarencia >= 180) {
        benefits.push({
            benefitName: "1.6) Aposentadoria por tempo de contribuição (Regra de Transição - Pontos)",
            isEligible: true,
            ruleType: 'Post-Reform',
            category: 'aposentadorias',
            rmi: calculateRMI(data.bonds, 'Post-Reform', data.gender, timeTotal.years)
        });
    } else {
        benefits.push({
            benefitName: "1.6) Aposentadoria por tempo de contribuição (Regra de Transição - Pontos)",
            isEligible: false,
            ruleType: 'Post-Reform',
            category: 'aposentadorias',
            missingDetails: `Pontos: ${points.toFixed(1)}/${pointsReq}. Tempo: ${timeTotal.years}/${progTimeReq}.`
        });
    }

    // --- 1.7 & 1.8 Aposentadoria Especial ---
    let specialTime15 = 0;
    let specialTime20 = 0;
    let specialTime25 = 0;
    
    data.bonds.forEach(b => {
        if (!b.useInCalculation || !b.startDate) return;
        const start = new Date(b.startDate);
        const end = b.endDate ? new Date(b.endDate) : new Date();
        const diff = end.getTime() - start.getTime();
        const days = diff / (1000 * 60 * 60 * 24);
        const years = days / 365.25;
        
        if (b.activityType === 'special_15') specialTime15 += years;
        if (b.activityType === 'special_20') specialTime20 += years;
        if (b.activityType === 'special_25') specialTime25 += years;
    });

    // 1.7 Aposentadoria Especial (Regra de Transição - Pontos)
    const specialPointsReq25 = 86;

    if (specialTime25 >= 25 && points >= specialPointsReq25 && totalCarencia >= 180) {
         benefits.push({
            benefitName: "1.7) Aposentadoria Especial (Regra de Transição - Pontos)",
            isEligible: true,
            ruleType: 'Transition',
            category: 'aposentadorias',
            rmi: calculateRMI(data.bonds, 'Post-Reform', data.gender, timeTotal.years)
        });
    } else {
         benefits.push({
            benefitName: "1.7) Aposentadoria Especial (Regra de Transição - Pontos)",
            isEligible: false,
            ruleType: 'Transition',
            category: 'aposentadorias',
            missingDetails: `Tempo Especial (25): ${specialTime25.toFixed(1)}/25. Pontos: ${points.toFixed(1)}/${specialPointsReq25}.`
        });
    }

    // 1.8 Aposentadoria Especial (Filiados após 13/11/2019)
    const specialAgeReq25 = 60;
    if (specialTime25 >= 25 && age.years >= specialAgeReq25 && totalCarencia >= 180) {
        benefits.push({
            benefitName: "1.8) Aposentadoria Especial (Filiados após 13/11/2019)",
            isEligible: true,
            ruleType: 'Post-Reform',
            category: 'aposentadorias',
            rmi: calculateRMI(data.bonds, 'Post-Reform', data.gender, timeTotal.years)
        });
    } else {
        benefits.push({
            benefitName: "1.8) Aposentadoria Especial (Filiados após 13/11/2019)",
            isEligible: false,
            ruleType: 'Post-Reform',
            category: 'aposentadorias',
            missingDetails: `Tempo Especial (25): ${specialTime25.toFixed(1)}/25. Idade: ${age.years}/${specialAgeReq25}.`
        });
    }

    // 1.9 Aposentadoria do Professor (Regra de Transição - Pedágio 100%)
    if (data.isTeacher) {
         benefits.push({
            benefitName: "1.9) Aposentadoria do Professor (Regra de Transição - Pedágio 100%)",
            isEligible: false,
            ruleType: 'Transition_100',
            category: 'aposentadorias',
            missingDetails: "Requer comprovação de tempo exclusivo em magistério."
        });
    } else {
        benefits.push({
            benefitName: "1.9) Aposentadoria do Professor (Regra de Transição - Pedágio 100%)",
            isEligible: false,
            ruleType: 'Transition_100',
            category: 'aposentadorias',
            missingDetails: "Não identificado como professor."
        });
    }

    // 1.10 Aposentadoria do Professor (Regra de Transição - Pontos)
    if (data.isTeacher) {
         benefits.push({
            benefitName: "1.10) Aposentadoria do Professor (Regra de Transição - Pontos)",
            isEligible: false,
            ruleType: 'Post-Reform',
            category: 'aposentadorias',
            missingDetails: "Requer comprovação de tempo exclusivo em magistério."
        });
    } else {
         benefits.push({
            benefitName: "1.10) Aposentadoria do Professor (Regra de Transição - Pontos)",
            isEligible: false,
            ruleType: 'Post-Reform',
            category: 'aposentadorias',
            missingDetails: "Não identificado como professor."
        });
    }

    // 1.11 Aposentadoria da Pessoa com Deficiência (Por Idade)
    const pcdAgeReq = data.gender === 'M' ? 60 : 55;
    if (data.isPcd) {
        if (age.years >= pcdAgeReq && timeTotal.years >= 15 && totalCarencia >= 180) {
             benefits.push({
                benefitName: "1.11) Aposentadoria da Pessoa com Deficiência (Por Idade)",
                isEligible: true,
                ruleType: 'Post-Reform',
                category: 'aposentadorias',
                rmi: calculateRMI(data.bonds, 'Post-Reform', data.gender, timeTotal.years)
            });
        } else {
             benefits.push({
                benefitName: "1.11) Aposentadoria da Pessoa com Deficiência (Por Idade)",
                isEligible: false,
                ruleType: 'Post-Reform',
                category: 'aposentadorias',
                missingDetails: `Idade: ${age.years}/${pcdAgeReq}. Tempo PCD: ${timeTotal.years}/15.`
            });
        }
    } else {
         benefits.push({
            benefitName: "1.11) Aposentadoria da Pessoa com Deficiência (Por Idade)",
            isEligible: false,
            ruleType: 'Post-Reform',
            category: 'aposentadorias',
            missingDetails: "Não identificado como PCD."
        });
    }

    // 1.12 Aposentadoria da Pessoa com Deficiência (Por Tempo de Contribuição)
    const pcdTimeReqLeve = data.gender === 'M' ? 33 : 28;
    if (data.isPcd) {
         if (timeTotal.years >= pcdTimeReqLeve && totalCarencia >= 180) {
            benefits.push({
                benefitName: "1.12) Aposentadoria da Pessoa com Deficiência (Por Tempo de Contribuição)",
                isEligible: true,
                ruleType: 'Post-Reform',
                category: 'aposentadorias',
                rmi: calculateRMI(data.bonds, 'Post-Reform', data.gender, timeTotal.years)
            });
         } else {
            benefits.push({
                benefitName: "1.12) Aposentadoria da Pessoa com Deficiência (Por Tempo de Contribuição)",
                isEligible: false,
                ruleType: 'Post-Reform',
                category: 'aposentadorias',
                missingDetails: `Tempo PCD (Leve): ${timeTotal.years}/${pcdTimeReqLeve}.`
            });
         }
    } else {
         benefits.push({
            benefitName: "1.12) Aposentadoria da Pessoa com Deficiência (Por Tempo de Contribuição)",
            isEligible: false,
            ruleType: 'Post-Reform',
            category: 'aposentadorias',
            missingDetails: "Não identificado como PCD."
        });
    }

    // 1.13 Aposentadoria por Incapacidade Permanente
    if (totalCarencia >= 12) {
         benefits.push({
            benefitName: "1.13) Aposentadoria por Incapacidade Permanente",
            isEligible: true,
            ruleType: 'Disability',
            category: 'aposentadorias',
            rmi: calculateRMI(data.bonds, 'Disability', data.gender, timeTotal.years),
            missingDetails: "Requer perícia médica confirmando incapacidade permanente."
        });
    } else {
        benefits.push({
            benefitName: "1.13) Aposentadoria por Incapacidade Permanente",
            isEligible: false,
            ruleType: 'Disability',
            category: 'aposentadorias',
            missingDetails: `Carência: ${totalCarencia}/12 meses.`
        });
    }

    // --- 2. AUXÍLIOS E SALÁRIOS ---

    // 2.1 Incapacidade Temporária
    // 12 meses carência.
    if (totalCarencia >= 12) {
        benefits.push({
            benefitName: "Auxílio por Incapacidade Temporária",
            isEligible: true,
            ruleType: 'Post-Reform',
            category: 'auxilios',
            rmi: calculateRMI(data.bonds, 'Post-Reform', data.gender, timeTotal.years) * 0.91 // 91%
        });
    } else {
        benefits.push({
            benefitName: "Auxílio por Incapacidade Temporária",
            isEligible: false,
            ruleType: 'Post-Reform',
            category: 'auxilios',
            missingDetails: `Carência: ${totalCarencia}/12 meses.`
        });
    }

    // 2.2 Auxílio-Acidente
    // Isento carência. Qualidade de segurado (simplified check: has recent bond).
    // Assuming quality of insured if last bond end date is recent (< 12 months)
    // This is a rough approx.
    const lastBond = data.bonds.reduce((latest, b) => {
        if (!b.endDate) return new Date(); // Active
        const end = new Date(b.endDate);
        return end > latest ? end : latest;
    }, new Date(0));
    
    const monthsSinceLastBond = (new Date(der).getTime() - lastBond.getTime()) / (1000 * 60 * 60 * 24 * 30);
    const hasQuality = monthsSinceLastBond <= 12; // Basic rule (ignoring grace period extensions)

    if (hasQuality) {
        benefits.push({
            benefitName: "Auxílio-Acidente",
            isEligible: true,
            ruleType: 'Post-Reform',
            category: 'auxilios',
            rmi: calculateRMI(data.bonds, 'Disability', data.gender, timeTotal.years) * 0.5 // 50% of Disability Retirement
        });
    } else {
        benefits.push({
            benefitName: "Auxílio-Acidente",
            isEligible: false,
            ruleType: 'Post-Reform',
            category: 'auxilios',
            missingDetails: "Requer qualidade de segurado (vínculo recente)."
        });
    }

    // 2.3 Salário-Maternidade
    // 10 meses carência (Individual/Facultativo). Empregado isento.
    // We don't know category perfectly, assuming 10 months safe check.
    if (totalCarencia >= 10) {
        benefits.push({
            benefitName: "Salário-Maternidade",
            isEligible: true,
            ruleType: 'Post-Reform',
            category: 'auxilios',
            rmi: calculateRMI(data.bonds, 'Post-Reform', data.gender, timeTotal.years) // Approx
        });
    } else {
        benefits.push({
            benefitName: "Salário-Maternidade",
            isEligible: false,
            ruleType: 'Post-Reform',
            category: 'auxilios',
            missingDetails: `Carência: ${totalCarencia}/10 meses.`
        });
    }

    // --- 3. BENEFÍCIOS AOS DEPENDENTES ---

    // 3.1 Pensão por Morte
    // Isento carência. Requer qualidade de segurado.
    if (hasQuality) {
        benefits.push({
            benefitName: "Pensão por Morte",
            isEligible: true,
            ruleType: 'Post-Reform',
            category: 'dependentes',
            rmi: calculateRMI(data.bonds, 'Death', data.gender, timeTotal.years)
        });
    } else {
        benefits.push({
            benefitName: "Pensão por Morte",
            isEligible: false,
            ruleType: 'Post-Reform',
            category: 'dependentes',
            missingDetails: "Instituidor deve ter qualidade de segurado."
        });
    }

    // 3.2 Auxílio-Reclusão
    // 24 meses carência. Baixa renda (check RMI < limit).
    // Limit 2024: R$ 1.819,26.
    const rmiEst = calculateRMI(data.bonds, 'Post-Reform', data.gender, timeTotal.years);
    const lowIncomeLimit = 1819.26;
    
    if (totalCarencia >= 24 && rmiEst <= lowIncomeLimit) {
        benefits.push({
            benefitName: "Auxílio-Reclusão",
            isEligible: true,
            ruleType: 'Post-Reform',
            category: 'dependentes',
            rmi: 1412.00 // Salário Mínimo
        });
    } else {
        benefits.push({
            benefitName: "Auxílio-Reclusão",
            isEligible: false,
            ruleType: 'Post-Reform',
            category: 'dependentes',
            missingDetails: `Carência: ${totalCarencia}/24. Renda: ${rmiEst > lowIncomeLimit ? 'Acima do limite' : 'Ok'}.`
        });
    }

    return {
        totalTime: timeTotal,
        totalCarencia,
        age,
        points,
        gender: data.gender,
        isTeacher: false,
        isPcd: false,
        benefits
    };
};

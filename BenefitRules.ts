import { CNISBond, SocialSecurityData } from './SocialSecurityCalc';

export interface BenefitResult {
    benefitName: string;
    isEligible: boolean;
    missingDetails?: string;
    rmi?: number;
    ruleType: 'Pre-Reform' | 'Transition' | 'Post-Reform';
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
    const birth = new Date(birthDateStr);
    const target = new Date(targetDateStr);
    
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
    ruleType: 'Pre-Reform' | 'Post-Reform' | 'Transition_50' | 'Transition_100',
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
        
        // Apply Fator Previdenciário (Simplified placeholder - would need complex calculation)
        // For now, return Average * 1.0 (assuming optimal or no factor for simplicity in this MVP)
        return average; 
    } else {
        // Average of 100% (Post-Reform)
        const sum = allSalaries.reduce((acc, curr) => acc + curr.value, 0);
        average = sum / allSalaries.length;

        // Apply Coefficients
        if (ruleType === 'Transition_100') {
            return average; // 100%
        } else if (ruleType === 'Transition_50') {
            // Apply Fator Previdenciário
            return average * 0.7; // Placeholder for Fator
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
        // Ideally iterate months between start/end, but for now use SC count or approx
        // Using SC count as proxy for carência if available, else date range
        if (b.sc.length > 0) {
            b.sc.forEach(s => uniqueMonths.add(s.month));
        } else if (b.startDate && b.endDate) {
            // Add range logic here if needed, simplified for now
            let start = new Date(b.startDate);
            let end = new Date(b.endDate);
            while(start <= end) {
                uniqueMonths.add(`${start.getMonth()+1}/${start.getFullYear()}`);
                start.setMonth(start.getMonth() + 1);
            }
        }
    });
    const totalCarencia = uniqueMonths.size;

    const points = age.years + timeTotal.years + (timeTotal.months / 12);

    const benefits: BenefitResult[] = [];

    // --- 1. Aposentadoria por Idade (Regra Geral) ---
    // Homem: 65 anos + 15 anos (se filiado antes) ou 20 (se depois). 
    // Simplificação: Assumindo filiado antes (maioria dos casos atuais) -> 15 anos.
    // Mulher: 62 anos + 15 anos.
    const ageReq = data.gender === 'M' ? 65 : 62;
    const timeReq = 15;
    
    if (age.years >= ageReq && timeTotal.years >= timeReq && totalCarencia >= 180) {
        benefits.push({
            benefitName: "Aposentadoria por Idade (Regra Geral)",
            isEligible: true,
            ruleType: 'Post-Reform',
            rmi: calculateRMI(data.bonds, 'Post-Reform', data.gender, timeTotal.years)
        });
    } else {
        benefits.push({
            benefitName: "Aposentadoria por Idade (Regra Geral)",
            isEligible: false,
            missingDetails: `Faltam: ${Math.max(0, ageReq - age.years)} anos de idade, ${Math.max(0, timeReq - timeTotal.years)} anos de contribuição.`,
            ruleType: 'Post-Reform'
        });
    }

    // --- 2. Aposentadoria por Tempo de Contribuição (Pontos) ---
    // 2024: H 101, M 91. Aumenta 1 ponto por ano.
    // 2025: H 102, M 92.
    // 2026: H 103, M 93.
    // Using 2026 rules as per prompt context (current date 2026)
    const pointsReq = data.gender === 'M' ? 103 : 93;
    const timeReqPoints = data.gender === 'M' ? 35 : 30;

    if (points >= pointsReq && timeTotal.years >= timeReqPoints) {
        benefits.push({
            benefitName: "Aposentadoria por Pontos (Transição)",
            isEligible: true,
            ruleType: 'Post-Reform', // Uses 60% + 2% rule
            rmi: calculateRMI(data.bonds, 'Post-Reform', data.gender, timeTotal.years)
        });
    } else {
        benefits.push({
            benefitName: "Aposentadoria por Pontos (Transição)",
            isEligible: false,
            missingDetails: `Pontos atuais: ${points.toFixed(1)}. Necessário: ${pointsReq}. Tempo: ${timeTotal.years}/${timeReqPoints}.`,
            ruleType: 'Post-Reform'
        });
    }

    // --- 3. Pedágio 100% ---
    // H: 60 anos, 35 contrib. M: 57 anos, 30 contrib.
    // + 100% do que faltava em 13/11/2019.
    const timeAtReform = calculateTimeForPeriod(data.bonds, '2019-11-13', data.gender);
    const timeNeededAtReform = data.gender === 'M' ? 35 : 30;
    const missingAtReform = Math.max(0, timeNeededAtReform - timeAtReform.years);
    const toll = missingAtReform; // 100%
    const totalTimeNeededToll100 = timeNeededAtReform + toll;
    const ageReqToll100 = data.gender === 'M' ? 60 : 57;

    if (age.years >= ageReqToll100 && timeTotal.years >= totalTimeNeededToll100) {
        benefits.push({
            benefitName: "Aposentadoria Pedágio 100%",
            isEligible: true,
            ruleType: 'Transition_100', // 100% average
            rmi: calculateRMI(data.bonds, 'Transition_100', data.gender, timeTotal.years)
        });
    } else {
        benefits.push({
            benefitName: "Aposentadoria Pedágio 100%",
            isEligible: false,
            missingDetails: `Idade: ${age.years}/${ageReqToll100}. Tempo Total Necessário (com pedágio): ${totalTimeNeededToll100.toFixed(1)} anos. Atual: ${timeTotal.years}.`,
            ruleType: 'Transition_100'
        });
    }

    // --- 4. Direito Adquirido (Pre-Reform) ---
    // H: 35, M: 30 até 13/11/2019
    if (timeAtReform.years >= timeNeededAtReform) {
        benefits.push({
            benefitName: "Direito Adquirido (Regras Pré-Reforma)",
            isEligible: true,
            ruleType: 'Pre-Reform',
            rmi: calculateRMI(data.bonds, 'Pre-Reform', data.gender, timeTotal.years)
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

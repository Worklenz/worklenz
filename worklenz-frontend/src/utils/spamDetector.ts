export interface SpamDetectionResult {
  isSpam: boolean;
  score: number;
  reasons: string[];
}

export class SpamDetector {
  private static readonly SPAM_PATTERNS = [
    // URLs and links
    /https?:\/\//i,
    /www\./i,
    /\b\w+\.(com|net|org|io|co|me|ly|tk|ml|ga|cf)\b/i,
    
    // Common spam phrases
    /click\s*(here|link|now)/i,
    /urgent|emergency|immediate/i,
    /win|won|winner|prize|reward/i,
    /free|bonus|gift|offer/i,
    /check\s*(out|this|pay)/i,
    /blockchain|crypto|bitcoin|compensation/i,
    /cash|money|dollars?|\$\d+/i,
    
    // Excessive special characters
    /[!]{3,}/,
    /[🔔⬅👆💰$]{2,}/,
    /\b[A-Z]{5,}\b/,
    
    // Suspicious formatting
    /\s{3,}/,
    /[.]{3,}/
  ];

  private static readonly SUSPICIOUS_WORDS = [
    'urgent', 'emergency', 'click', 'link', 'win', 'winner', 'prize', 
    'free', 'bonus', 'cash', 'money', 'blockchain', 'crypto', 'compensation',
    'check', 'pay', 'reward', 'offer', 'gift'
  ];

  public static detectSpam(text: string): SpamDetectionResult {
    if (!text || typeof text !== 'string') {
      return { isSpam: false, score: 0, reasons: [] };
    }

    const normalizedText = text.toLowerCase().trim();
    const reasons: string[] = [];
    let score = 0;

    // Check for URL patterns
    for (const pattern of this.SPAM_PATTERNS) {
      if (pattern.test(text)) {
        score += 30;
        if (pattern.toString().includes('https?') || pattern.toString().includes('www')) {
          reasons.push('Contains suspicious URLs or links');
        } else if (pattern.toString().includes('urgent|emergency')) {
          reasons.push('Contains urgent/emergency language');
        } else if (pattern.toString().includes('win|won|winner')) {
          reasons.push('Contains prize/winning language');
        } else if (pattern.toString().includes('cash|money')) {
          reasons.push('Contains monetary references');
        } else if (pattern.toString().includes('blockchain|crypto')) {
          reasons.push('Contains cryptocurrency references');
        } else if (pattern.toString().includes('[!]{3,}')) {
          reasons.push('Excessive use of exclamation marks');
        } else if (pattern.toString().includes('[🔔⬅👆💰$]')) {
          reasons.push('Contains suspicious emojis or symbols');
        } else if (pattern.toString().includes('[A-Z]{5,}')) {
          reasons.push('Contains excessive capital letters');
        }
      }
    }

    // Check for excessive suspicious words
    const suspiciousWordCount = this.SUSPICIOUS_WORDS.filter(word => 
      normalizedText.includes(word)
    ).length;
    
    if (suspiciousWordCount >= 2) {
      score += suspiciousWordCount * 15;
      reasons.push(`Contains ${suspiciousWordCount} suspicious words`);
    }

    // Check text length - very short or very long names are suspicious
    if (text.length < 2) {
      score += 20;
      reasons.push('Text too short');
    } else if (text.length > 100) {
      score += 25;
      reasons.push('Text unusually long');
    }

    // Check for repeated characters
    if (/(.)\1{4,}/.test(text)) {
      score += 20;
      reasons.push('Contains repeated characters');
    }

    // Check for mixed scripts (potential homograph attack)
    const hasLatin = /[a-zA-Z]/.test(text);
    const hasCyrillic = /[\u0400-\u04FF]/.test(text);
    const hasGreek = /[\u0370-\u03FF]/.test(text);
    
    if ((hasLatin && hasCyrillic) || (hasLatin && hasGreek)) {
      score += 40;
      reasons.push('Contains mixed character scripts');
    }

    const isSpam = score >= 50;
    
    return {
      isSpam,
      score,
      reasons: [...new Set(reasons)] // Remove duplicates
    };
  }

  public static isHighRiskContent(text: string): boolean {
    const patterns = [
      /gclnk\.com/i,
      /bit\.ly/i,
      /tinyurl/i,
      /\$\d{3,}/,
      /blockchain.*compensation/i,
      /urgent.*check/i
    ];

    return patterns.some(pattern => pattern.test(text));
  }

  public static sanitizeText(text: string): string {
    if (!text || typeof text !== 'string') return '';
    
    return text
      .trim()
      .replace(/https?:\/\/[^\s]+/gi, '[URL_REMOVED]')
      .replace(/www\.[^\s]+/gi, '[URL_REMOVED]')
      .replace(/[🔔⬅👆💰$]{2,}/g, '')
      .replace(/[!]{3,}/g, '!')
      .replace(/\s{3,}/g, ' ')
      .substring(0, 100);
  }
}
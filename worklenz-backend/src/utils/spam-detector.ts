import loggerModule from "./logger";

const { logger } = loggerModule;

export interface SpamDetectionResult {
  isSpam: boolean;
  score: number;
  reasons: string[];
}

export class SpamDetector {
  // Whitelist for legitimate organizations that might trigger false positives
  private static readonly WHITELIST_PATTERNS = [
    /^(microsoft|google|apple|amazon|facebook|meta|twitter|linkedin|github|stackoverflow)$/i,
    /^.*(inc|llc|ltd|corp|corporation|company|co|group|enterprises|solutions|services|consulting|tech|technologies|agency|studio|lab|labs|systems|software|development|designs?)$/i,
    // Allow "free" when it's clearly about software/business
    /free.*(software|source|lance|consulting|solutions|services|tech|development|range|market|trade)/i,
    /(open|free).*(software|source)/i,
    // Common legitimate business patterns
    /^[a-z]+\s+(software|solutions|services|consulting|tech|technologies|systems|development|designs?|agency|studio|labs?|group|company)$/i,
    /^(the\s+)?[a-z]+\s+(company|group|studio|agency|lab|labs)$/i
  ];

  private static readonly SPAM_PATTERNS = [
    // URLs and links
    /https?:\/\//i,
    /www\./i,
    /\b\w+\.(com|net|org|io|co|me|ly|tk|ml|ga|cf|cc|to|us|biz|info|xyz)\b/i,
    
    // Common spam phrases
    /click\s*(here|link|now)/i,
    /urgent|emergency|immediate|limited.time/i,
    /win|won|winner|prize|reward|congratulations/i,
    /free|bonus|gift|offer|special.offer/i,
    /check\s*(out|this|pay)|verify|claim/i,
    /blockchain|crypto|bitcoin|compensation|investment/i,
    /cash|money|dollars?|\$\d+|earn.*money/i,
    
    // Excessive special characters
    /[!]{2,}/,
    /[🔔⬅👆💰$💎🎁🎉⚡]{1,}/,
    /\b[A-Z]{4,}\b/,
    
    // Suspicious formatting
    /\s{3,}/,
    /[.]{3,}/,
    
    // Additional suspicious patterns
    /act.now|don.t.miss|guaranteed|limited.spots/i,
    /download|install|app|software/i,
    /survey|questionnaire|feedback/i,
    /\d+%.*off|save.*\$|discount/i
  ];

  private static readonly SUSPICIOUS_WORDS = [
    "urgent", "emergency", "click", "link", "win", "winner", "prize", 
    "free", "bonus", "cash", "money", "blockchain", "crypto", "compensation",
    "check", "pay", "reward", "offer", "gift", "congratulations", "claim",
    "verify", "earn", "investment", "guaranteed", "limited", "exclusive",
    "download", "install", "survey", "feedback", "discount", "save"
  ];

  public static detectSpam(text: string): SpamDetectionResult {
    if (!text || typeof text !== "string") {
      return { isSpam: false, score: 0, reasons: [] };
    }

    const normalizedText = text.toLowerCase().trim();
    const reasons: string[] = [];
    let score = 0;

    // Check for obviously fake organization names FIRST (before whitelist)
    if (/^(test|example|demo|fake|spam|abuse|temp)\s*(company|org|corp|inc|llc)?$/i.test(text.trim()) ||
        /(test|demo|fake|spam|abuse|temp)\s*(123|abc|xyz|\d+)/i.test(text)) {
      score += 30;
      reasons.push("Contains generic/test name patterns");
    }
    
    // Check whitelist - bypass remaining checks for whitelisted organizations
    if (score === 0) { // Only check whitelist if no generic patterns found
      for (const pattern of this.WHITELIST_PATTERNS) {
        if (pattern.test(normalizedText)) {
          return { isSpam: false, score: 0, reasons: [] };
        }
      }
    }

    // Check for URL patterns
    for (const pattern of this.SPAM_PATTERNS) {
      if (pattern.test(text)) {
        score += 25; // Lowered from 30 to catch more suspicious content
        if (pattern.toString().includes("https?") || pattern.toString().includes("www")) {
          reasons.push("Contains suspicious URLs or links");
        } else if (pattern.toString().includes("urgent|emergency")) {
          reasons.push("Contains urgent/emergency language");
        } else if (pattern.toString().includes("win|won|winner")) {
          reasons.push("Contains prize/winning language");
        } else if (pattern.toString().includes("cash|money")) {
          reasons.push("Contains monetary references");
        } else if (pattern.toString().includes("blockchain|crypto")) {
          reasons.push("Contains cryptocurrency references");
        } else if (pattern.toString().includes("[!]{3,}")) {
          reasons.push("Excessive use of exclamation marks");
        } else if (pattern.toString().includes("[🔔⬅👆💰$]")) {
          reasons.push("Contains suspicious emojis or symbols");
        } else if (pattern.toString().includes("[A-Z]{5,}")) {
          reasons.push("Contains excessive capital letters");
        }
      }
    }

    // Check for excessive suspicious words - Now with context awareness
    const suspiciousWords = this.SUSPICIOUS_WORDS.filter(word => {
      if (!normalizedText.includes(word)) return false;
      
      // Context-aware filtering for common false positives
      if (word === 'free') {
        // Allow "free" in legitimate software/business contexts
        return !/free.*(software|source|lance|consulting|solutions|services|tech|development|range|market|trade)/i.test(text);
      }
      
      if (word === 'check') {
        // Allow "check" in legitimate business contexts  
        return !/check.*(list|mark|point|out|up|in|book|ing|ed)/i.test(text);
      }
      
      if (word === 'save') {
        // Allow "save" in legitimate business contexts
        return !/save.*(data|file|document|time|energy|environment|earth)/i.test(text);
      }
      
      return true; // Other words are still suspicious
    });
    
    if (suspiciousWords.length >= 1) {
      score += suspiciousWords.length * 20;
      reasons.push(`Contains ${suspiciousWords.length} suspicious word${suspiciousWords.length > 1 ? 's' : ''}: ${suspiciousWords.join(', ')}`);
    }

    // Check text length - very short or very long names are suspicious
    if (text.length < 2) {
      score += 20;
      reasons.push("Text too short");
    } else if (text.length > 100) {
      score += 25;
      reasons.push("Text unusually long");
    }

    // Check for repeated characters
    if (/(.)\1{4,}/.test(text)) {
      score += 20;
      reasons.push("Contains repeated characters");
    }

    // Check for mixed scripts (potential homograph attack)
    const hasLatin = /[a-zA-Z]/.test(text);
    const hasCyrillic = /[\u0400-\u04FF]/.test(text);
    const hasGreek = /[\u0370-\u03FF]/.test(text);
    
    if ((hasLatin && hasCyrillic) || (hasLatin && hasGreek)) {
      score += 40;
      reasons.push("Contains mixed character scripts");
    }

    // Generic name check already done above - skip duplicate check

    // Check for excessive numbers in organization names (often spam)
    if (/\d{4,}/.test(text)) {
      score += 25;
      reasons.push("Contains excessive numbers");
    }

    const isSpam = score >= 50;
    
    // Log suspicious activity for Slack notifications
    if (isSpam || score > 30) {
      logger.warn("🚨 SPAM DETECTED", {
        text: text.substring(0, 100),
        score,
        reasons: [...new Set(reasons)],
        isSpam,
        timestamp: new Date().toISOString(),
        alert_type: "spam_detection"
      });
    }
    
    return {
      isSpam,
      score,
      reasons: [...new Set(reasons)] // Remove duplicates
    };
  }

  public static isHighRiskContent(text: string): boolean {
    const patterns = [
      /gclnk\.com/i,
      /bit\.ly\/scam/i,  // More specific bit.ly patterns
      /tinyurl\.com\/scam/i,
      /\$\d{3,}.*crypto/i,  // Money + crypto combination
      /blockchain.*compensation.*urgent/i,
      /win.*\$\d+.*urgent/i,  // Win money urgent pattern
      /click.*here.*\$\d+/i   // Click here money pattern
    ];

    const isHighRisk = patterns.some(pattern => pattern.test(text));
    
    // Log high-risk content immediately
    if (isHighRisk) {
      logger.error("🔥 HIGH RISK CONTENT DETECTED", {
        text: text.substring(0, 100),
        matched_patterns: patterns.filter(pattern => pattern.test(text)).map(p => p.toString()),
        timestamp: new Date().toISOString(),
        alert_type: "high_risk_content"
      });
    }
    
    return isHighRisk;
  }

  public static shouldBlockContent(text: string): boolean {
    const result = this.detectSpam(text);
    // Only block if extremely high score or high-risk patterns
    return result.score > 80 || this.isHighRiskContent(text);
  }

  public static shouldFlagContent(text: string): boolean {
    const result = this.detectSpam(text);
    // Flag anything suspicious (score > 0) but not necessarily blocked
    return result.score > 0 || result.reasons.length > 0;
  }

  public static sanitizeText(text: string): string {
    if (!text || typeof text !== "string") return "";
    
    return text
      .trim()
      .replace(/https?:\/\/[^\s]+/gi, "[URL_REMOVED]")
      .replace(/www\.[^\s]+/gi, "[URL_REMOVED]")
      .replace(/[🔔⬅👆💰$]{2,}/g, "")
      .replace(/[!]{3,}/g, "!")
      .replace(/\s{3,}/g, " ")
      .substring(0, 100);
  }
}
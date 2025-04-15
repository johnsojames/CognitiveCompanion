import { LLMFactory } from '../llm/factory';
import { LLMProvider } from '../llm/provider';

/**
 * Manages user personalization and learning from interactions
 */
class PersonalizationManager {
  private llmFactory: LLMFactory | null = null;
  private llmProvider: LLMProvider | null = null;
  
  /**
   * Set the LLM factory for personalization
   * @param llmFactory LLM factory
   */
  setLLMFactory(llmFactory: LLMFactory): void {
    this.llmFactory = llmFactory;
    console.log("Personalization manager initialized with LLM factory");
    
    // We'll initialize the LLM provider lazily when needed, not here
  }
  
  /**
   * Learn vocabulary and linguistic patterns from user text
   * @param userId User ID
   * @param text User input text
   */
  async learnVocabularyPatterns(userId: number, text: string): Promise<void> {
    if (!text || text.trim().length === 0) return;
    
    try {
      // Extract potential vocabulary patterns
      const patterns = this.extractVocabularyPatterns(text);
      
      if (patterns.length === 0) return;
      
      // Store the patterns in memory
      // This would normally store in a database, but for this prototype
      // we'll just log what we've learned
      console.log(`Learned vocabulary patterns for user ${userId}:`, patterns);
    } catch (error) {
      console.error("Error learning vocabulary patterns:", error);
    }
  }
  
  /**
   * Extract vocabulary patterns from text
   * @param text Text to analyze
   * @returns Array of vocabulary patterns
   */
  private extractVocabularyPatterns(text: string): string[] {
    const patterns: string[] = [];
    
    // Normalize text
    const normalizedText = text.toLowerCase().trim();
    
    // Extract domain-specific terms (longer words that might be specialized)
    const words = normalizedText.split(/\s+/);
    const potentialTerms = words.filter(word => 
      word.length > 7 && 
      !this.isCommonWord(word)
    );
    
    // Deduplicate
    const uniqueTerms = [...new Set(potentialTerms)];
    patterns.push(...uniqueTerms);
    
    // Extract phrases (2-3 word combinations)
    const phrases = this.extractPhrases(normalizedText);
    patterns.push(...phrases);
    
    // Extract potential abbreviations (uppercase sequences)
    const abbreviations = this.extractAbbreviations(text);
    patterns.push(...abbreviations);
    
    return patterns;
  }
  
  /**
   * Check if a word is common
   * @param word Word to check
   * @returns True if word is common
   */
  private isCommonWord(word: string): boolean {
    const commonWords = [
      'the', 'and', 'that', 'have', 'for', 'not', 'with', 'you', 'this', 'but',
      'his', 'from', 'they', 'who', 'will', 'would', 'there', 'their', 'what',
      'about', 'which', 'when', 'make', 'like', 'time', 'just', 'know', 'take',
      'person', 'year', 'your', 'good', 'some', 'could', 'them', 'than', 'then',
      'look', 'only', 'come', 'over', 'think', 'also', 'back', 'after', 'work',
      'first', 'well', 'even', 'want', 'because', 'these', 'give', 'most'
    ];
    
    return commonWords.includes(word);
  }
  
  /**
   * Extract meaningful phrases from text
   * @param text Text to analyze
   * @returns Array of phrases
   */
  private extractPhrases(text: string): string[] {
    const phrases: string[] = [];
    const words = text.split(/\s+/);
    
    // Extract 2-word phrases
    for (let i = 0; i < words.length - 1; i++) {
      if (words[i].length > 3 && words[i+1].length > 3) {
        // Both words are substantial
        phrases.push(`${words[i]} ${words[i+1]}`);
      }
    }
    
    // Extract 3-word phrases
    for (let i = 0; i < words.length - 2; i++) {
      if (words[i].length > 2 && words[i+1].length > 2 && words[i+2].length > 2) {
        // All three words are substantial
        phrases.push(`${words[i]} ${words[i+1]} ${words[i+2]}`);
      }
    }
    
    // Return only unique phrases
    return [...new Set(phrases)];
  }
  
  /**
   * Extract potential abbreviations from text
   * @param text Text to analyze
   * @returns Array of abbreviations
   */
  private extractAbbreviations(text: string): string[] {
    const abbreviations: string[] = [];
    
    // Look for uppercase sequences that might be abbreviations
    const matches = text.match(/\b[A-Z]{2,}\b/g);
    if (matches) {
      abbreviations.push(...matches);
    }
    
    return abbreviations;
  }
  
  /**
   * Analyze text for user preferences
   * @param userId User ID
   * @param text User input text
   * @returns Potential preferences found
   */
  async extractPreferences(userId: number, text: string): Promise<Array<{key: string, value: string, confidence: number}>> {
    if (!text || text.trim().length === 0) return [];
    if (!this.llmFactory) return [];
    
    try {
      // Lazy-initialize LLM provider if needed
      if (!this.llmProvider) {
        this.llmProvider = this.llmFactory.getLLMProvider(
          "claude", 
          "claude-3-7-sonnet-20250219"
        );
      }
      
      const prompt = `Analyze the following user text to identify potential user preferences. 
Look for indicators of preferences in topics, styles, formats, or other aspects.
Extract only clear preferences with reasonable confidence (at least 70%).

User text: "${text}"

Format your response as a JSON array with objects having these properties:
- key: The preference category (e.g., "topic_interest", "communication_style", "format_preference")
- value: The specific preference value
- confidence: A number between 0.7 and 1.0 indicating confidence level

Return an empty array [] if no preferences can be detected with sufficient confidence.`;

      const response = await this.llmProvider.generateResponse(prompt, "", []);
      
      try {
        // Try to parse the response as JSON
        const preferences = JSON.parse(response);
        if (Array.isArray(preferences)) {
          return preferences.map(pref => ({
            key: pref.key || "",
            value: pref.value || "",
            confidence: typeof pref.confidence === 'number' ? 
              Math.max(0, Math.min(1, pref.confidence)) : 0.7
          }));
        }
      } catch (e) {
        console.error("Error parsing preferences response:", e);
      }
      
      return [];
    } catch (error) {
      console.error("Error extracting preferences:", error);
      return [];
    }
  }
  
  /**
   * Adapt content based on user's vocabulary patterns
   * @param userId User ID
   * @param content Content to adapt
   * @returns Adapted content
   */
  async adaptContentToUser(userId: number, content: string): Promise<string> {
    // This would normally retrieve user vocabulary patterns from database
    // For now, as a prototype, we're not adapting the content
    return content;
  }
}

export const personalizationManager = new PersonalizationManager();
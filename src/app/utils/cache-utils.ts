import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';
import { ChecklistByStageAndCategory } from './filter-utils';

@Injectable({
  providedIn: 'root'
})
export class CacheUtils {
  private readonly CACHED_CHECKLIST_KEY_BASE = `cachedChecklist_v3`;
  private readonly CACHED_FORM_DATA_KEY_BASE = `cachedFormDataForChecklist_v3`;

  constructor(private storage: Storage) {}

  /**
   * Initialize cache keys with user-specific prefix
   */
  getUserSpecificCacheKeys(userEmailPrefix: string): { checklistKey: string, formDataKey: string } {
    const sanitizedPrefix = userEmailPrefix.replace(/[^a-zA-Z0-9]/g, '_') || 'default_user';
    return {
      checklistKey: `${sanitizedPrefix}_${this.CACHED_CHECKLIST_KEY_BASE}`,
      formDataKey: `${sanitizedPrefix}_${this.CACHED_FORM_DATA_KEY_BASE}`
    };
  }

  /**
   * Load cached checklist data from storage
   */
  async loadCachedChecklist(cacheKey: string): Promise<any> {
    try {
      const cachedData = await this.storage.get(cacheKey);
      return cachedData;
    } catch (error) {
      console.error("Error loading cached checklist:", error);
      return null;
    }
  }

  /**
   * Load cached form data from storage
   */
  async loadCachedFormData(cacheKey: string): Promise<any> {
    try {
      const cachedFormData = await this.storage.get(cacheKey);
      return cachedFormData;
    } catch (error) {
      console.error("Error loading cached form data:", error);
      return null;
    }
  }

  /**
   * Save checklist data and stage progress to cache
   */
  async saveChecklistToCache(
    checklistKey: string, 
    formDataKey: string, 
    checklistData: ChecklistByStageAndCategory, 
    stageProgress: { [key: string]: { current: number, total: number } },
    formData: any
  ): Promise<void> {
    // Include stageProgress in the cached data
    const dataToCache = {
      ...checklistData,
      stageProgress: stageProgress
    };
    
    // Use Promise.all to run these operations in parallel
    await Promise.all([
      this.storage.set(checklistKey, dataToCache),
      this.storage.set(formDataKey, formData)
    ]);
  }

  /**
   * Check if the cached form data matches the current form data
   */
  formDataHasChanged(currentFormData: any, cachedFormData: any): boolean {
    return JSON.stringify(currentFormData) !== JSON.stringify(cachedFormData);
  }

  /**
   * Compare cached form data with current form data
   */
  async shouldGenerateNewChecklist(
    checklistKey: string,
    formDataKey: string,
    currentFormData: any
  ): Promise<boolean> {
    try {
      const [cachedChecklist, cachedFormData] = await Promise.all([
        this.loadCachedChecklist(checklistKey),
        this.loadCachedFormData(formDataKey)
      ]);
      
      // If no cached checklist, generate new one
      if (!cachedChecklist) return true;
      
      // If form data has changed, generate new one
      return this.formDataHasChanged(currentFormData, cachedFormData);
    } catch (error) {
      console.error("Error comparing cached data:", error);
      return true; // Generate new checklist on error
    }
  }
} 
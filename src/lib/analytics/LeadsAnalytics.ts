export interface LeadsStats {
  newLeads: number
  wonLeads: number
  lostLeads: number
}

export class LeadsAnalytics {
  async calculateForDate(dateString: string): Promise<LeadsStats> {
    // Заготовка под расширение аналитики сделок amoCRM
    return {
      newLeads: 0,
      wonLeads: 0,
      lostLeads: 0,
    }
  }
}

export const leadsAnalytics = new LeadsAnalytics()

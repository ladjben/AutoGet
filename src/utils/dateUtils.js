// Utilitaires pour calculer les périodes (jour, semaine, mois)

export const getTodayDate = () => {
  return new Date().toISOString().split('T')[0];
};

export const getCurrentWeekRange = () => {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Dimanche, 1 = Lundi, etc.
  const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Ajuster pour commencer le lundi
  const monday = new Date(today.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0]
  };
};

export const getCurrentMonthRange = () => {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  
  return {
    start: firstDay.toISOString().split('T')[0],
    end: lastDay.toISOString().split('T')[0]
  };
};

export const isDateInRange = (date, startDate, endDate) => {
  if (!date) return false;
  return date >= startDate && date <= endDate;
};

export const filterByPeriod = (items, dateField, period) => {
  if (!items || !Array.isArray(items)) return [];
  
  const today = getTodayDate();
  let startDate, endDate;
  
  switch (period) {
    case 'today':
      startDate = today;
      endDate = today;
      break;
    case 'week':
      const weekRange = getCurrentWeekRange();
      startDate = weekRange.start;
      endDate = weekRange.end;
      break;
    case 'month':
      const monthRange = getCurrentMonthRange();
      startDate = monthRange.start;
      endDate = monthRange.end;
      break;
    default:
      return items;
  }
  
  return items.filter(item => {
    const itemDate = item[dateField];
    return isDateInRange(itemDate, startDate, endDate);
  });
};


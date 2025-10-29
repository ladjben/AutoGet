import { filterByPeriod } from '../utils/dateUtils';

// Composant réutilisable pour afficher les statistiques par période
const PeriodStatsCards = ({ title, data, dateField, statsCalculator }) => {
  const today = filterByPeriod(data, dateField, 'today');
  const week = filterByPeriod(data, dateField, 'week');
  const month = filterByPeriod(data, dateField, 'month');

  const statsToday = statsCalculator(today);
  const statsWeek = statsCalculator(week);
  const statsMonth = statsCalculator(month);

  return (
    <div className="bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 rounded-2xl p-6 border-4 border-gray-300 shadow-xl mb-6">
      <h2 className="text-xl font-bold text-gray-800 mb-5 flex items-center gap-2">
        <span className="bg-white p-2 rounded-lg shadow-sm text-lg">📅</span>
        <span>{title}</span>
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Journalier */}
        <div className="bg-gradient-to-br from-blue-100 to-blue-200 border-3 border-blue-400 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="bg-blue-500 text-white p-2 rounded-lg text-xl">📆</span>
            <span className="text-xs text-blue-700 font-bold bg-blue-300 px-3 py-1 rounded-full">
              Aujourd'hui
            </span>
          </div>
          <div className="space-y-2">
            {Object.entries(statsToday).map(([key, value]) => (
              <div key={key} className="flex justify-between items-center">
                <span className="text-xs text-blue-700 font-medium">{key}:</span>
                <span className="text-sm font-bold text-blue-900">
                  {typeof value === 'number' ? (value % 1 !== 0 ? value.toFixed(2) : value) : value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Hebdomadaire */}
        <div className="bg-gradient-to-br from-green-100 to-green-200 border-3 border-green-400 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="bg-green-500 text-white p-2 rounded-lg text-xl">📅</span>
            <span className="text-xs text-green-700 font-bold bg-green-300 px-3 py-1 rounded-full">
              Cette Semaine
            </span>
          </div>
          <div className="space-y-2">
            {Object.entries(statsWeek).map(([key, value]) => (
              <div key={key} className="flex justify-between items-center">
                <span className="text-xs text-green-700 font-medium">{key}:</span>
                <span className="text-sm font-bold text-green-900">
                  {typeof value === 'number' ? (value % 1 !== 0 ? value.toFixed(2) : value) : value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Mensuel */}
        <div className="bg-gradient-to-br from-purple-100 to-purple-200 border-3 border-purple-400 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="bg-purple-500 text-white p-2 rounded-lg text-xl">📊</span>
            <span className="text-xs text-purple-700 font-bold bg-purple-300 px-3 py-1 rounded-full">
              Ce Mois
            </span>
          </div>
          <div className="space-y-2">
            {Object.entries(statsMonth).map(([key, value]) => (
              <div key={key} className="flex justify-between items-center">
                <span className="text-xs text-purple-700 font-medium">{key}:</span>
                <span className="text-sm font-bold text-purple-900">
                  {typeof value === 'number' ? (value % 1 !== 0 ? value.toFixed(2) : value) : value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PeriodStatsCards;


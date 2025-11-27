import { useState } from 'react';
import { useMLPrediction } from '@/hooks/useMLPrediction';
import MLInsights, { LegSummary } from '@/components/bets/MLInsights';

export function MLScenarioSimulator() {
  const [stake, setStake] = useState(50);
  const [legs, setLegs] = useState<Array<{ odd: number }>>([{ odd: 1.8 }]);
  const {
    predict,
    prediction,
    loading,
    error,
    lastUpdated,
    reset,
  } = useMLPrediction();

  const legSummaries: LegSummary[] = legs.map((leg, index) => ({
    id: `sim-${index}`,
    odd: leg.odd,
    label: `Hypothetical Leg ${index + 1}`,
  }));

  const handleRunSimulation = async () => {
    if (!legs.length || legs.some((leg) => leg.odd <= 1)) {
      alert('Add legs with decimal odds greater than 1.');
      return;
    }

    await predict({
      legs: legs.map((leg) => ({ odd: leg.odd })),
      stake,
    });
  };

  const addLeg = () => {
    setLegs((prev) => [...prev, { odd: 1.5 }]);
  };

  const updateLeg = (index: number, value: number) => {
    setLegs((prev) =>
      prev.map((leg, i) => (i === index ? { odd: value } : leg))
    );
    reset();
  };

  const removeLeg = (index: number) => {
    setLegs((prev) => prev.filter((_, i) => i !== index));
    reset();
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white/60 px-4 py-5 shadow-sm sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            ML Scenario Simulator
          </p>
          <p className="text-xs text-gray-500">
            Test hypothetical parlays before you place them.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRunSimulation}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50"
          disabled={loading || !legs.length}
        >
          {loading ? 'Predicting...' : 'Run Prediction'}
        </button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <label className="block text-xs font-medium text-gray-600">
            Stake (bankroll units)
          </label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={stake.toString()}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '' || /^\d+$/.test(value)) {
                setStake(Number(value) || 0);
              reset();
              }
            }}
            placeholder="50"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm min-h-[44px]"
          />
        </div>
        <div className="lg:col-span-2">
          <label className="block text-xs font-medium text-gray-600">
            Legs (decimal odds)
          </label>
          <div className="mt-1 space-y-2">
            {legs.map((leg, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*\.?[0-9]*"
                  value={leg.odd.toString()}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || /^\d*\.?\d*$/.test(value)) {
                      updateLeg(index, Number(value) || 0);
                    }
                  }}
                  placeholder="2.00"
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm min-h-[44px]"
                />
                {legs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLeg(index)}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 min-h-[44px] flex items-center justify-center"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addLeg}
            className="mt-2 text-xs font-semibold text-primary-600 hover:text-primary-700 min-h-[44px] flex items-center"
          >
            + Add another leg
          </button>
        </div>
      </div>

      <div className="mt-6">
        <MLInsights
          title="Scenario Prediction"
          legs={legSummaries}
          stake={stake}
          prediction={prediction}
          loading={loading}
          error={error}
          onRetry={handleRunSimulation}
          lastUpdated={lastUpdated}
        />
      </div>
    </section>
  );
}

export default MLScenarioSimulator;


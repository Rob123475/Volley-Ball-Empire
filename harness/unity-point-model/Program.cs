using System;
using System.Globalization;
using System.Text;

// Usage: dotnet run -- <matches> <seed> <chance> [<chance> ...]
// Prints one JSON line: for each chance, home match wins and every set score.
//
// The draws come from mulberry32, seeded per chance with seed + index, the
// same generator harness/one-set-of-odds.mjs feeds the game's engine, so both
// models play from one stream of numbers: identical logic must give identical
// matches, and any difference is the logic, not the dice.
public static class Program
{
    private sealed class Mulberry32
    {
        private uint _a;
        public Mulberry32(uint seed) { _a = seed; }
        public double Next()
        {
            _a = unchecked(_a + 0x6D2B79F5u);
            uint t = _a;
            t = unchecked((t ^ (t >> 15)) * (t | 1u));
            t ^= unchecked(t + (t ^ (t >> 7)) * (t | 61u));
            return (t ^ (t >> 14)) / 4294967296.0;
        }
    }

    public static int Main(string[] args)
    {
        if (args.Length > 0 && args[0] == "boosts") return BoostsMode.Run(args);
        int n = int.Parse(args[0], CultureInfo.InvariantCulture);
        uint seed = uint.Parse(args[1], CultureInfo.InvariantCulture);
        StringBuilder sb = new StringBuilder("{\"runs\":[");
        for (int a = 2; a < args.Length; a++)
        {
            double chance = double.Parse(args[a], CultureInfo.InvariantCulture);
            Mulberry32 rng = new Mulberry32(seed + (uint)(a - 2));
            int homeWins = 0;
            StringBuilder sets = new StringBuilder();
            for (int i = 0; i < n; i++)
            {
                MatchScore m = new MatchScore();
                while (!m.IsOver) m.AddPoint(PointModel.HomeWinsPoint(chance, 0.0, rng.Next()));
                if (m.HomeWon) homeWins++;
                foreach (int[] s in m.FinishedSets)
                {
                    if (sets.Length > 0) sets.Append(',');
                    sets.Append('[').Append(s[0]).Append(',').Append(s[1]).Append(']');
                }
                if (sets.Length > 0) sets.Append(',');
                sets.Append("\"|").Append(m.HomeSets).Append('-').Append(m.AwaySets).Append('"');
            }
            if (a > 2) sb.Append(',');
            sb.Append("{\"chance\":").Append(chance.ToString("R", CultureInfo.InvariantCulture))
              .Append(",\"matches\":").Append(n).Append(",\"homeWins\":").Append(homeWins)
              .Append(",\"sets\":[").Append(sets).Append("]}");
        }
        sb.Append("]}");
        Console.WriteLine(sb.ToString());
        return 0;
    }
}

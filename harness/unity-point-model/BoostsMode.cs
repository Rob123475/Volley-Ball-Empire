using System;
using System.Globalization;
using System.Text;

// "boosts" mode for harness/boosts.mjs: dotnet run -- boosts <matches> <seed> <chance> [...]
// For each chance, match wins under four ways of using the boosts: never,
// Attack every time it is ready, Defence every time, or the two in turn.
// Runs Unity's own BoostClock.cs and PointModel.cs, exactly as MatchManager
// uses them: a boost switched on before a point is decided counts for it.
public static class BoostsMode
{
    public static int Run(string[] args)
    {
        int n = int.Parse(args[1], CultureInfo.InvariantCulture);
        int seed = int.Parse(args[2], CultureInfo.InvariantCulture);
        string[] policies = { "none", "attack", "defence", "alternate" };
        StringBuilder sb = new StringBuilder();
        sb.Append("{\"activePoints\":").Append(BoostClock.ActivePoints)
          .Append(",\"cooldownPoints\":").Append(BoostClock.CooldownPoints)
          .Append(",\"attackShift\":").Append(BoostClock.AttackShift.ToString("R", CultureInfo.InvariantCulture))
          .Append(",\"defenceShift\":").Append(BoostClock.DefenceShift.ToString("R", CultureInfo.InvariantCulture))
          .Append(",\"results\":[");
        for (int a = 3; a < args.Length; a++)
        {
            double chance = double.Parse(args[a], CultureInfo.InvariantCulture);
            if (a > 3) sb.Append(',');
            sb.Append('{');
            for (int k = 0; k < policies.Length; k++)
            {
                Random rng = new Random(seed * 131 + a * 17 + k);
                int wins = 0;
                for (int i = 0; i < n; i++)
                {
                    BoostClock clock = new BoostClock();
                    MatchScore m = new MatchScore();
                    bool nextAttack = true;
                    while (!m.IsOver)
                    {
                        if (policies[k] != "none" && clock.Ready)
                        {
                            BoostMode use = policies[k] == "attack" ? BoostMode.Attack
                                : policies[k] == "defence" ? BoostMode.Defence
                                : (nextAttack ? BoostMode.Attack : BoostMode.Defence);
                            if (clock.TryActivate(use)) nextAttack = !nextAttack;
                        }
                        m.AddPoint(PointModel.HomeWinsPoint(chance, clock.CurrentShift, rng.NextDouble()));
                        clock.OnPointPlayed();
                    }
                    if (m.HomeWon) wins++;
                }
                if (k > 0) sb.Append(',');
                sb.Append('"').Append(policies[k]).Append("\":").Append(wins);
            }
            sb.Append('}');
        }
        sb.Append("]}");
        Console.WriteLine(sb.ToString());
        return 0;
    }
}

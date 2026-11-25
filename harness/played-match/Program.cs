using System;
using System.Linq;
using Played;

// 1.2 Part A: the played-match engine's checks, run by dotnet on the Unity repo's own files.
// Usage: dotnet run -c Release -- <section> [<section> ...]   (sections: A1, A2, ...)
//        dotnet run -c Release -- sim <matches> <difficulty> <ratingA> <ratingB>   (AI v AI, for looking)
// Exit code 0 only when every check in every section asked for passed.
public static class Program
{
    public static int Main(string[] args)
    {
        if (args.Length > 0 && args[0] == "sim") return Sim(args);
        if (args.Length > 0 && args[0] == "trace") return Trace(args);
        if (args.Length == 0) args = new[] { "A1" };
        int failed = 0, passed = 0;
        foreach (string section in args)
        {
            var m = typeof(PlayedMatchChecks).GetMethod(section);
            if (m == null) { Console.WriteLine("No section " + section); return 2; }
            var r = (PlayedMatchChecks.Report)m.Invoke(null, null);
            Console.Write(r.Text.ToString());
            failed += r.Failed; passed += r.Passed;
        }
        Console.WriteLine($"RESULT: {(failed == 0 && passed > 0 ? "PASS" : "FAIL")} ({passed} passed, {failed} failed)");
        return failed == 0 && passed > 0 ? 0 : 1;
    }

    private static int Trace(string[] a)
    {
        int points = int.Parse(a[1]);
        var d = Difficulty.Medium;
        var ratings = new[] { Ratings.All(62), Ratings.All(62), Ratings.All(62), Ratings.All(62) };
        var e = new PlayedEngine(ratings, new MatchScore(), d, 5, 0, 0);
        var seats = PlayedMatchSims.AllAi(d, 5);
        for (int i = 0; i < 4; i++) e.Seats[i] = seats[i];
        int seen = 0;
        while (seen < points && e.Time < 3000)
        {
            e.Tick();
            foreach (var ev in e.Events)
            {
                if (ev.type == EngineEventType.ReceiverChanged || ev.type == EngineEventType.PositionsTaken) continue;
                string extra = "";
                if (ev.type == EngineEventType.Contact || ev.type == EngineEventType.Serve) extra = " ball " + ev.at + " -> " + ev.strike.target + " v " + ev.strike.vel.Length.ToString("F1") + (ev.strike.wild ? " WILD" : "") + " pos p" + ev.player + " " + e.P[ev.player].pos;
                if (ev.type == EngineEventType.Block) extra = " at " + ev.at + " blocker " + e.P[ev.player].pos;
                Console.WriteLine("  " + ev + extra);
                if (ev.type == EngineEventType.Point) { seen++; Console.WriteLine("  ----"); }
            }
            e.Events.Clear();
        }
        return 0;
    }

    private static int Sim(string[] a)
    {
        int n = int.Parse(a[1]);
        var d = (Difficulty)Enum.Parse(typeof(Difficulty), a[2]);
        int ra = int.Parse(a[3]), rb = int.Parse(a[4]);
        int homeWins = 0;
        for (int k = 0; k < n; k++)
        {
            var ratings = new[] { Ratings.All(ra), Ratings.All(ra), Ratings.All(rb), Ratings.All(rb) };
            ulong seed = (ulong)(1000 + k);
            var s = PlayedMatchSims.Play(ratings, d, seed, PlayedMatchSims.AllAi(d, seed));
            if (s.HomeWon) homeWins++;
            Console.WriteLine($"match {k + 1}: " + PlayedMatchSims.Describe(s));
            if (k == 0) { Console.WriteLine("  grades: " + string.Join(", ", s.grades.OrderBy(x => x.Key).Select(x => x.Key + " " + x.Value))); Console.WriteLine("  whiffs: " + string.Join(", ", s.whyWhiff.OrderByDescending(x => x.Value).Select(x => x.Key + " " + x.Value))); }
        }
        Console.WriteLine($"home won {homeWins}/{n}");
        return 0;
    }
}

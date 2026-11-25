using System;

// 1.2 Part A: the played-match engine's checks, run by dotnet on the Unity repo's own files.
// Usage: dotnet run -c Release -- <section> [<section> ...]   (sections: A1, A2, ...)
// Exit code 0 only when every check in every section asked for passed.
public static class Program
{
    public static int Main(string[] args)
    {
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
}

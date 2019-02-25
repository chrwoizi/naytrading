using System;
using System.Collections.Generic;
using System.Configuration;
using System.IO;

namespace NAYtrading.Trader
{
    public class FlatexTanProvider : ITanProvider
    {
        private const char FirstColumn = '1';
        private const char LastColumn = '9';

        private static readonly List<char> Rows = new List<char>() { 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'K', 'L', 'M' };

        private readonly string passwordHash;

        public FlatexTanProvider(string passwordHash)
        {
            this.passwordHash = passwordHash;
        }

        public string GetTans()
        {
            string cipher;

            try
            {
                cipher = File.ReadAllText(ConfigurationManager.AppSettings["TanFilePath"]);
            }
            catch (Exception ex)
            {
                throw new Exception("Could not load TAN file", ex);
            }

            string[] tans;

            var tansStr = StringCipher.Decrypt(cipher, passwordHash);
            return tansStr;
        }

        public string GetTan(object tanChallenge)
        {
            var flatexTanChallenge = (Flatex.TanChallenge)tanChallenge;
            return GetTan(flatexTanChallenge.TanChallenge1, flatexTanChallenge.TanChallenge2, flatexTanChallenge.TanChallenge3);
        }

        public string GetTan(string challenge1, string challenge2, string challenge3)
        {
            string cipher;

            try
            {
                cipher = File.ReadAllText(ConfigurationManager.AppSettings["TanFilePath"]);
            }
            catch (Exception ex)
            {
                throw new Exception("Could not load TAN file", ex);
            }

            string[] tans;

            try
            {
                var tansStr = StringCipher.Decrypt(cipher, passwordHash);
                tans = tansStr.Split(',');
                if (tans.Length != (LastColumn - FirstColumn + 1) * Rows.Count)
                {
                    throw new Exception();
                }
            }
            catch (Exception)
            {
                throw new Exception("Could not decrypt TAN file");
            }

            try
            {
                var tan = GetTan(tans, challenge1) + GetTan(tans, challenge2) + GetTan(tans, challenge3);
                return tan;
            }
            catch (IndexOutOfRangeException)
            {
                throw new Exception("TAN challenge is incompatible");
            }
        }

        private string GetTan(string[] tans, string challenge)
        {
            // 1-9 A-M
            int row = Rows.IndexOf(challenge[0]);
            int column = challenge[1] - FirstColumn;
            return tans[row * (LastColumn - FirstColumn + 1) + column];
        }
    }
}

using System;
using System.Collections.Generic;
using System.Configuration;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

namespace StockFlow.Trader
{
    public class TanProvider
    {
        private const char FirstRow = 'A';
        private const char LastRow = 'M';
        private const char FirstColumn = '1';
        private const char LastColumn = '9';

        public string GetTan(string challenge1, string challenge2, string challenge3, string passwordHash)
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
                if (tans.Length != (LastColumn - FirstColumn + 1) * (LastRow - FirstRow + 1))
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
            int row = challenge[0] - FirstRow;
            int column = challenge[1] - FirstColumn;
            return tans[row * (LastColumn - FirstColumn + 1) + column];
        }
    }
}

using Newtonsoft.Json;
using System;
using System.IO;
using System.Text;

namespace StockFlow.Common
{
    public class Importer
    {
        public static void Import<T>(Stream stream, Action<T> importer)
        {
            var reader = new StreamReader(stream, Encoding.UTF8);

            var c = (char)reader.Read();
            if (c == '[')
            {
                ImportList<T>(reader, importer);
            }
            else
            {
                throw new Exception("Should start with [");
            }
        }

        private static void ImportList<T>(StreamReader reader, Action<T> importer)
        {
            while (!reader.EndOfStream)
            {
                var character = reader.Read();

                if (character == '{')
                {
                    ImportListItem<T>(reader, importer);
                }
                else if (character == ']')
                {
                    return;
                }
            }
        }

        private static void ImportListItem<T>(StreamReader reader, Action<T> importer)
        {
            var sb = new StringBuilder("{");
            bool isInQuotes = false;
            int scopes = 1;
            var previousCharacter = (char)0;
            while (!reader.EndOfStream)
            {
                var character = (char)reader.Read();
                sb.Append(character);

                if (previousCharacter != '\\' && character == '\"')
                {
                    isInQuotes = !isInQuotes;
                }
                else if (!isInQuotes && character == '{')
                {
                    scopes++;
                }
                else if (!isInQuotes && character == '}')
                {
                    scopes--;

                    if (scopes == 0)
                    {
                        var json = sb.ToString();
                        var item = JsonConvert.DeserializeObject<T>(json);
                        importer(item);
                        return;
                    }
                }

                previousCharacter = character;
            }
        }

    }
}

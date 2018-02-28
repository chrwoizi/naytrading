using System;
using System.Collections.Generic;
using System.Configuration;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using System.Web;

namespace StockFlow.Trader
{
    public class HttpProvider
    {
        private CookieContainer cookies;

        public HttpProvider()
        {
            cookies = new CookieContainer();
        }

        public async Task<string> Login(string url, string user, string password)
        {
            using (HttpClientHandler handler = CreateHandler())
            {
                using (HttpClient httpClient = new HttpClient(handler) { BaseAddress = new Uri(url) })
                {
                    httpClient.Timeout = TimeSpan.FromMinutes(2);

                    var pageWithToken = await httpClient.GetAsync(httpClient.BaseAddress);
                    var verificationToken = GetVerificationToken(await pageWithToken.Content.ReadAsStringAsync());

                    var contentToSend = new FormUrlEncodedContent(new[]
                        {
                        new KeyValuePair<string, string>("__RequestVerificationToken", verificationToken),
                        new KeyValuePair<string, string>("Email", user),
                        new KeyValuePair<string, string>("Password", password),
                        new KeyValuePair<string, string>("RememberMe", "true"),
                    });

                    var response = await httpClient.PostAsync(httpClient.BaseAddress, contentToSend);
                    return await response.Content.ReadAsStringAsync();
                }
            }
        }

        public async Task<string> Get(string url)
        {
            using (HttpClientHandler handler = CreateHandler())
            {
                using (HttpClient httpClient = new HttpClient(handler) { BaseAddress = new Uri(url) })
                {
                    httpClient.Timeout = TimeSpan.FromMinutes(2);

                    return await httpClient.GetStringAsync(httpClient.BaseAddress);
                }
            }
        }

        private static string GetVerificationToken(string verificationToken)
        {
            if (verificationToken != null && verificationToken.Length > 0)
            {
                verificationToken = verificationToken.Substring(verificationToken.IndexOf("__RequestVerificationToken"));
                verificationToken = verificationToken.Substring(verificationToken.IndexOf("value=\"") + 7);
                verificationToken = verificationToken.Substring(0, verificationToken.IndexOf("\""));
            }

            return verificationToken;
        }

        private HttpClientHandler CreateHandler()
        {
            var handler = new HttpClientHandler();

            var proxyAddress = ConfigurationManager.AppSettings.Get("ProxyAddress");
            if (!string.IsNullOrEmpty(proxyAddress))
            {
                handler.Proxy = new WebProxy(new Uri(proxyAddress, UriKind.Absolute));
                handler.Proxy.Credentials = new NetworkCredential(ConfigurationManager.AppSettings.Get("ProxyUser"), ConfigurationManager.AppSettings.Get("ProxyPassword"));
                handler.UseProxy = true;
            }

            handler.UseCookies = true;
            handler.UseDefaultCredentials = true;
            handler.CookieContainer = cookies;

            return handler;
        }
    }
}
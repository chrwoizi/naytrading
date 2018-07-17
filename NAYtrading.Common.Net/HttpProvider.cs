using System;
using System.Collections.Generic;
using System.Configuration;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;

namespace NAYtrading.Common.Net
{
    public class HttpProvider
    {
        private CookieContainer cookies;

        public string ProxyAddress;
        public string ProxyUser;
        public string ProxyPassword;

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

                    var contentToSend = new FormUrlEncodedContent(new[]
                        {
                        new KeyValuePair<string, string>("email", user),
                        new KeyValuePair<string, string>("password", password),
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

        public async Task<string> Post(string url)
        {
            using (HttpClientHandler handler = CreateHandler())
            {
                using (HttpClient httpClient = new HttpClient(handler) { BaseAddress = new Uri(url) })
                {
                    httpClient.Timeout = TimeSpan.FromMinutes(2);
                    
                    var contentToSend = new ByteArrayContent(new byte[0]);

                    var response = await httpClient.PostAsync(httpClient.BaseAddress, contentToSend);
                    return await response.Content.ReadAsStringAsync();
                }
            }
        }

        public async Task<WebStream> GetStream(string url)
        {
            HttpClientHandler handler = CreateHandler();
            try
            {
                HttpClient httpClient = new HttpClient(handler) { BaseAddress = new Uri(url) };
                try
                {
                    httpClient.Timeout = TimeSpan.FromMinutes(2);

                    return new WebStream(
                        await httpClient.GetStreamAsync(httpClient.BaseAddress),
                        handler, httpClient);
                }
                catch
                {
                    httpClient.Dispose();
                    throw;
                }
            }
            catch
            {
                handler.Dispose();
                throw;
            }
        }

        private HttpClientHandler CreateHandler()
        {
            var handler = new HttpClientHandler();
            
            if (!string.IsNullOrEmpty(ProxyAddress))
            {
                handler.Proxy = new WebProxy(new Uri(ProxyAddress, UriKind.Absolute));
                handler.Proxy.Credentials = new NetworkCredential(ProxyUser, ProxyPassword);
                handler.UseProxy = true;
            }

            handler.UseCookies = true;
            handler.UseDefaultCredentials = true;
            handler.CookieContainer = cookies;

            return handler;
        }
    }
}
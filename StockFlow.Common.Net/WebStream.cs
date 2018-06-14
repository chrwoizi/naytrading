using System;
using System.IO;
using System.Net.Http;

namespace StockFlow.Common.Net
{
    public class WebStream : Stream
    {
        private Stream stream;
        private HttpClientHandler handler;
        private HttpClient httpClient;

        public WebStream(Stream stream, HttpClientHandler handler, HttpClient httpClient)
        {
            this.stream = stream;
            this.handler = handler;
            this.httpClient = httpClient;
        }

        protected override void Dispose(bool disposing)
        {
            base.Dispose(disposing);
            stream.Dispose();
            httpClient.Dispose();
            handler.Dispose();
        }

        public override bool CanRead => stream.CanRead;

        public override bool CanSeek => stream.CanSeek;

        public override bool CanWrite => stream.CanWrite;

        public override long Length => stream.Length;

        public override long Position { get => stream.Position; set => stream.Position = value; }

        public override void Flush()
        {
            stream.Flush();
        }

        public override int Read(byte[] buffer, int offset, int count)
        {
            return stream.Read(buffer, offset, count);
        }

        public override long Seek(long offset, SeekOrigin origin)
        {
            return stream.Seek(offset, origin);
        }

        public override void SetLength(long value)
        {
            stream.SetLength(value);
        }

        public override void Write(byte[] buffer, int offset, int count)
        {
            stream.Write(buffer, offset, count);
        }
    }
}
using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;

namespace DBConfig
{
    public static class CryptoHelper
    {
        private const string Passphrase = "RealcommerceSecretKeyPassphrase";

        private static byte[] GetEncryptionKey()
        {
            using (var sha256 = SHA256.Create())
            {
                return sha256.ComputeHash(Encoding.UTF8.GetBytes(Passphrase));
            }
        }

        public static string Encrypt(string plainText)
        {
            if (string.IsNullOrEmpty(plainText)) return string.Empty;

            byte[] key = GetEncryptionKey();
            byte[] iv = new byte[16];

            using (var rng = RandomNumberGenerator.Create())
            {
                rng.GetBytes(iv);
            }

            using (var aes = Aes.Create())
            {
                aes.Key = key;
                aes.IV = iv;
                aes.Mode = CipherMode.CBC;
                aes.Padding = PaddingMode.PKCS7;

                using (var encryptor = aes.CreateEncryptor())
                using (var ms = new MemoryStream())
                {
                    using (var cs = new CryptoStream(ms, encryptor, CryptoStreamMode.Write))
                    {
                        byte[] plainBytes = Encoding.UTF8.GetBytes(plainText);
                        cs.Write(plainBytes, 0, plainBytes.Length);
                        cs.FlushFinalBlock();
                    }

                    byte[] cipherBytes = ms.ToArray();
                    
                    // Format: iv_hex + ":" + ciphertext_hex (compatible with Node)
                    string ivHex = Convert.ToHexString(iv).ToLower();
                    string cipherHex = Convert.ToHexString(cipherBytes).ToLower();

                    return $"{ivHex}:{cipherHex}";
                }
            }
        }

        public static string? Decrypt(string encryptedText)
        {
            if (string.IsNullOrEmpty(encryptedText)) return null;

            try
            {
                string[] parts = encryptedText.Split(':');
                if (parts.Length != 2) return null;

                byte[] iv = Convert.FromHexString(parts[0]);
                byte[] cipherText = Convert.FromHexString(parts[1]);
                byte[] key = GetEncryptionKey();

                using (var aes = Aes.Create())
                {
                    aes.Key = key;
                    aes.IV = iv;
                    aes.Mode = CipherMode.CBC;
                    aes.Padding = PaddingMode.PKCS7;

                    using (var decryptor = aes.CreateDecryptor())
                    using (var ms = new MemoryStream())
                    {
                        using (var cs = new CryptoStream(ms, decryptor, CryptoStreamMode.Write))
                        {
                            cs.Write(cipherText, 0, cipherText.Length);
                            cs.FlushFinalBlock();
                        }

                        byte[] plainBytes = ms.ToArray();
                        return Encoding.UTF8.GetString(plainBytes);
                    }
                }
            }
            catch
            {
                return null;
            }
        }

        public static void ClearFileAttributes(string path)
        {
            try
            {
                if (File.Exists(path))
                {
                    File.SetAttributes(path, FileAttributes.Normal);
                }
            }
            catch { }
        }

        public static void HideFile(string path)
        {
            try
            {
                if (Environment.OSVersion.Platform == PlatformID.Win32NT)
                {
                    File.SetAttributes(path, File.GetAttributes(path) | FileAttributes.Hidden);
                }
            }
            catch { }
        }
    }
}


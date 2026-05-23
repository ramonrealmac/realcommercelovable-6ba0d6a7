using System;
using System.Windows.Forms;

namespace DBConfig
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            // Enable visual styles and set standard configurations
            ApplicationConfiguration.Initialize();

            // Run Login dialog first
            using (var loginForm = new LoginForm())
            {
                if (loginForm.ShowDialog() == DialogResult.OK)
                {
                    // If login correct, open main form
                    Application.Run(new MainForm());
                }
            }
        }
    }
}

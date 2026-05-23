using System;
using System.Drawing;
using System.IO;
using System.Windows.Forms;

namespace DBConfig
{
    public class LoginForm : Form
    {
        private TextBox _passwordTextBox;
        private Button _loginButton;
        private Button _cancelButton;
        private Label _errorLabel;
        private CheckBox _showPasswordCheckBox;

        private const string DefaultAdminPassword = "S0ftw@y1";
        private readonly string _configFile;

        public LoginForm()
        {
            // Define path to DBConfig.ini in parent directory
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            // Support both running from bin/Release/net7.0-windows/ and directly from project root
            string projectDir = Path.GetFullPath(Path.Combine(baseDir, ".."));
            if (!File.Exists(Path.Combine(projectDir, "package.json")))
            {
                // If package.json doesn't exist, we might be running inside the project root directly or published
                projectDir = baseDir;
            }
            _configFile = Path.Combine(projectDir, "DBConfig.ini");

            InitializeComponent();
        }

        private void InitializeComponent()
        {
            this.Text = "Acesso Administrativo - DBConfig";
            this.Size = new Size(400, 270);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.MinimizeBox = false;
            this.BackColor = Color.FromArgb(15, 23, 42); // Dark Slate 900
            this.ForeColor = Color.FromArgb(241, 245, 249);
            this.Font = new Font("Segoe UI", 9.5f);

            var mainLayout = new TableLayoutPanel()
            {
                Dock = DockStyle.Fill,
                ColumnCount = 1,
                RowCount = 5,
                Padding = new Padding(25),
            };
            mainLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 45)); // Title
            mainLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 35)); // Label
            mainLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 35)); // Input
            mainLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 25)); // Error msg / checkbox
            mainLayout.RowStyles.Add(new RowStyle(SizeType.Percent, 100)); // Buttons
            this.Controls.Add(mainLayout);

            var titleLabel = new Label()
            {
                Text = "Configurador de Banco de Dados",
                Font = new Font("Segoe UI", 12.5f, FontStyle.Bold),
                ForeColor = Color.White,
                AutoSize = true,
                Dock = DockStyle.Fill
            };
            mainLayout.Controls.Add(titleLabel, 0, 0);

            var infoLabel = new Label()
            {
                Text = "Digite a senha de administrador para gerenciar conexões:",
                ForeColor = Color.FromArgb(148, 163, 184), // Slate-400
                AutoSize = true,
                Dock = DockStyle.Fill
            };
            mainLayout.Controls.Add(infoLabel, 0, 1);

            _passwordTextBox = new TextBox()
            {
                UseSystemPasswordChar = true,
                Dock = DockStyle.Fill,
                BackColor = Color.FromArgb(2, 6, 23), // Slate-950
                ForeColor = Color.White,
                BorderStyle = BorderStyle.FixedSingle,
                Font = new Font("Segoe UI", 11f)
            };
            mainLayout.Controls.Add(_passwordTextBox, 0, 2);

            var optionsLayout = new FlowLayoutPanel()
            {
                Dock = DockStyle.Fill,
                FlowDirection = FlowDirection.LeftToRight
            };
            mainLayout.Controls.Add(optionsLayout, 0, 3);

            _showPasswordCheckBox = new CheckBox()
            {
                Text = "Mostrar Senha",
                AutoSize = true,
                Font = new Font("Segoe UI", 8.5f),
                ForeColor = Color.FromArgb(148, 163, 184)
            };
            _showPasswordCheckBox.CheckedChanged += (s, e) =>
            {
                _passwordTextBox.UseSystemPasswordChar = !_showPasswordCheckBox.Checked;
            };
            optionsLayout.Controls.Add(_showPasswordCheckBox);

            _errorLabel = new Label()
            {
                Text = "",
                ForeColor = Color.FromArgb(239, 68, 68), // Red-500
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                AutoSize = true,
                Margin = new Padding(10, 3, 0, 0)
            };
            optionsLayout.Controls.Add(_errorLabel);

            var buttonsLayout = new FlowLayoutPanel()
            {
                Dock = DockStyle.Fill,
                FlowDirection = FlowDirection.RightToLeft,
                Padding = new Padding(0, 10, 0, 0)
            };
            mainLayout.Controls.Add(buttonsLayout, 0, 4);

            _cancelButton = new Button()
            {
                Text = "Cancelar",
                DialogResult = DialogResult.Cancel,
                Width = 90,
                Height = 30,
                BackColor = Color.FromArgb(30, 41, 59),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat
            };
            _cancelButton.FlatAppearance.BorderSize = 0;
            buttonsLayout.Controls.Add(_cancelButton);

            _loginButton = new Button()
            {
                Text = "Desbloquear",
                Width = 110,
                Height = 30,
                BackColor = Color.FromArgb(16, 185, 129), // Emerald-500
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat
            };
            _loginButton.FlatAppearance.BorderSize = 0;
            _loginButton.Click += (s, e) => AttemptLogin();
            buttonsLayout.Controls.Add(_loginButton);

            this.AcceptButton = _loginButton;
            this.CancelButton = _cancelButton;
        }

        private void AttemptLogin()
        {
            _errorLabel.Text = "";
            string password = _passwordTextBox.Text;

            if (string.IsNullOrEmpty(password))
            {
                _errorLabel.Text = "Digite a senha.";
                return;
            }

            string expectedPassword = GetAdminPassword();
            if (password == expectedPassword)
            {
                this.DialogResult = DialogResult.OK;
                this.Close();
            }
            else
            {
                _errorLabel.Text = "Senha incorreta.";
                _passwordTextBox.Clear();
                _passwordTextBox.Focus();
            }
        }

        private string GetAdminPassword()
        {
            if (!File.Exists(_configFile))
            {
                // Create file and save encrypted default password
                string encrypted = CryptoHelper.Encrypt(DefaultAdminPassword);
                CryptoHelper.ClearFileAttributes(_configFile);
                File.WriteAllText(_configFile, encrypted);
                CryptoHelper.HideFile(_configFile);
                return DefaultAdminPassword;
            }

            try
            {
                string content = File.ReadAllText(_configFile).Trim();
                string? decrypted = CryptoHelper.Decrypt(content);
                if (decrypted == null)
                {
                    // Healing: if decryption fails, recreate with default password
                    string encrypted = CryptoHelper.Encrypt(DefaultAdminPassword);
                    CryptoHelper.ClearFileAttributes(_configFile);
                    File.WriteAllText(_configFile, encrypted);
                    CryptoHelper.HideFile(_configFile);
                    return DefaultAdminPassword;
                }
                return decrypted;
            }
            catch
            {
                return DefaultAdminPassword;
            }
        }
    }
}

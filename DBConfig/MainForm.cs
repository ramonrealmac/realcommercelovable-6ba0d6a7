using System;
using System.Collections.Generic;
using System.Data;
using System.Drawing;
using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Windows.Forms;
using Npgsql;

namespace DBConfig
{
    public class MainForm : Form
    {
        private ListBox _profilesListBox;
        private TextBox _profileNameTextBox;
        private TextBox _supabaseUrlTextBox;
        private TextBox _supabaseKeyTextBox;
        private TextBox _dbPasswordTextBox;
        private TextBox _dbPortTextBox;
        private TextBox _dbNameTextBox;
        private TextBox _dbUserTextBox;

        private RichTextBox _sqlTextBox;
        private DataGridView _sqlGrid;
        private Label _sqlInfoLabel;

        private TextBox _currentPassTextBox;
        private TextBox _newPassTextBox;
        private TextBox _confirmPassTextBox;

        private List<ConnectionProfile> _profiles = new();
        private ConnectionProfile? _selectedProfile;
        
        private readonly string _connectionsFile;
        private readonly string _configFile;
        private readonly string _envFile;

        public MainForm()
        {
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string projectDir = Path.GetFullPath(Path.Combine(baseDir, ".."));
            if (!File.Exists(Path.Combine(projectDir, "package.json")))
            {
                projectDir = baseDir;
            }
            _connectionsFile = Path.Combine(projectDir, "DBConnections.json");
            _configFile = Path.Combine(projectDir, "DBConfig.ini");
            _envFile = Path.Combine(projectDir, ".env");

            InitializeComponent();
            LoadProfiles();
            LoadActiveConnectionInfo();
        }

        private void InitializeComponent()
        {
            this.Text = "Configurador de Banco de Dados - Realcommerce";
            this.Size = new Size(950, 620);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.FromArgb(15, 23, 42); // Slate 900
            this.ForeColor = Color.FromArgb(241, 245, 249);
            this.Font = new Font("Segoe UI", 9.5f);

            var tabControl = new TabControl()
            {
                Dock = DockStyle.Fill,
                Padding = new Point(12, 6)
            };
            this.Controls.Add(tabControl);

            // Tab 1: Connections
            var tabConnections = new TabPage("Conexões Supabase") { BackColor = Color.FromArgb(15, 23, 42) };
            SetupConnectionsTab(tabConnections);
            tabControl.TabPages.Add(tabConnections);

            // Tab 2: SQL Terminal
            var tabSql = new TabPage("Executar Consulta (SQL)") { BackColor = Color.FromArgb(15, 23, 42) };
            SetupSqlTab(tabSql);
            tabControl.TabPages.Add(tabSql);

            // Tab 3: Security
            var tabSecurity = new TabPage("Segurança") { BackColor = Color.FromArgb(15, 23, 42) };
            SetupSecurityTab(tabSecurity);
            tabControl.TabPages.Add(tabSecurity);
        }

        private void SetupConnectionsTab(TabPage page)
        {
            var mainLayout = new TableLayoutPanel()
            {
                Dock = DockStyle.Fill,
                ColumnCount = 2,
                RowCount = 1,
                Padding = new Padding(15)
            };
            mainLayout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 30)); // Profiles list
            mainLayout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 70)); // Form editor
            page.Controls.Add(mainLayout);

            // Left Side: Profiles List
            var listLayout = new TableLayoutPanel()
            {
                Dock = DockStyle.Fill,
                ColumnCount = 1,
                RowCount = 2
            };
            listLayout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
            listLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 40));
            mainLayout.Controls.Add(listLayout, 0, 0);

            _profilesListBox = new ListBox()
            {
                Dock = DockStyle.Fill,
                BackColor = Color.FromArgb(2, 6, 23), // Slate-950
                ForeColor = Color.White,
                BorderStyle = BorderStyle.FixedSingle,
                Font = new Font("Segoe UI", 10f, FontStyle.Bold)
            };
            _profilesListBox.SelectedIndexChanged += (s, e) => OnProfileSelected();
            listLayout.Controls.Add(_profilesListBox, 0, 0);

            var addBtn = new Button()
            {
                Text = "+ Novo Perfil",
                Dock = DockStyle.Fill,
                BackColor = Color.FromArgb(30, 41, 59),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat
            };
            addBtn.FlatAppearance.BorderSize = 0;
            addBtn.Click += (s, e) => ClearForm();
            listLayout.Controls.Add(addBtn, 0, 1);

            // Right Side: Form Editor
            var formLayout = new TableLayoutPanel()
            {
                Dock = DockStyle.Fill,
                ColumnCount = 2,
                RowCount = 10,
                Padding = new Padding(15, 0, 0, 0)
            };
            formLayout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 30));
            formLayout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 70));
            mainLayout.Controls.Add(formLayout, 1, 0);

            // Form Fields
            AddFormRow(formLayout, 0, "Nome do Perfil:", _profileNameTextBox = CreateInput("Ex: Produção, Homologação"));
            AddFormRow(formLayout, 1, "Supabase URL:", _supabaseUrlTextBox = CreateInput("https://project-id.supabase.co"));
            AddFormRow(formLayout, 2, "Chave Anon/Publishable:", _supabaseKeyTextBox = CreateInput("eyJhbGciOi..."));
            
            // Section divider
            var divider = new Label()
            {
                Text = "Configuração do PostgreSQL (Para Consultas SQL)",
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold | FontStyle.Underline),
                ForeColor = Color.FromArgb(16, 185, 129), // Emerald
                AutoSize = true,
                Margin = new Padding(0, 15, 0, 5)
            };
            formLayout.Controls.Add(divider, 0, 3);
            formLayout.SetColumnSpan(divider, 2);

            AddFormRow(formLayout, 4, "Senha do Banco (Postgres):", _dbPasswordTextBox = CreateInput("Senha do banco de dados", true));
            AddFormRow(formLayout, 5, "Porta (Padrão 5432):", _dbPortTextBox = CreateInput("5432"));
            AddFormRow(formLayout, 6, "Banco de Dados (postgres):", _dbNameTextBox = CreateInput("postgres"));
            AddFormRow(formLayout, 7, "Usuário (postgres):", _dbUserTextBox = CreateInput("postgres"));

            // Info Label
            _sqlInfoLabel = new Label()
            {
                Text = "",
                ForeColor = Color.FromArgb(148, 163, 184),
                Font = new Font("Segoe UI", 8.5f, FontStyle.Italic),
                AutoSize = true,
                Margin = new Padding(0, 5, 0, 0)
            };
            formLayout.Controls.Add(_sqlInfoLabel, 0, 8);
            formLayout.SetColumnSpan(_sqlInfoLabel, 2);

            // Action Buttons Footer
            var buttonsLayout = new FlowLayoutPanel()
            {
                Dock = DockStyle.Fill,
                FlowDirection = FlowDirection.LeftToRight,
                Padding = new Padding(0, 15, 0, 0)
            };
            formLayout.Controls.Add(buttonsLayout, 0, 9);
            formLayout.SetColumnSpan(buttonsLayout, 2);

            var saveBtn = new Button()
            {
                Text = "Salvar Perfil",
                Width = 110,
                Height = 35,
                BackColor = Color.FromArgb(30, 41, 59),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat
            };
            saveBtn.FlatAppearance.BorderSize = 0;
            saveBtn.Click += (s, e) => SaveProfile();
            buttonsLayout.Controls.Add(saveBtn);

            var testBtn = new Button()
            {
                Text = "Testar Conexão",
                Width = 130,
                Height = 35,
                BackColor = Color.FromArgb(30, 41, 59),
                ForeColor = Color.FromArgb(209, 213, 219),
                FlatStyle = FlatStyle.Flat
            };
            testBtn.FlatAppearance.BorderSize = 0;
            testBtn.Click += async (s, e) => await TestConnection();
            buttonsLayout.Controls.Add(testBtn);

            var deleteBtn = new Button()
            {
                Text = "Excluir Perfil",
                Width = 110,
                Height = 35,
                BackColor = Color.FromArgb(127, 29, 29),
                ForeColor = Color.FromArgb(252, 165, 165),
                FlatStyle = FlatStyle.Flat
            };
            deleteBtn.FlatAppearance.BorderSize = 0;
            deleteBtn.Click += (s, e) => DeleteProfile();
            buttonsLayout.Controls.Add(deleteBtn);

            // Space separator
            var spacer = new Label() { Width = 30, Height = 10 };
            buttonsLayout.Controls.Add(spacer);

            var applyBtn = new Button()
            {
                Text = "Gravar no .env",
                Width = 140,
                Height = 35,
                BackColor = Color.FromArgb(16, 185, 129), // Emerald
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold)
            };
            applyBtn.FlatAppearance.BorderSize = 0;
            applyBtn.Click += (s, e) => ApplyToEnv();
            buttonsLayout.Controls.Add(applyBtn);

            var loadFromEnvBtn = new Button()
            {
                Text = "Importar do .env",
                Width = 140,
                Height = 35,
                BackColor = Color.FromArgb(30, 41, 59),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold)
            };
            loadFromEnvBtn.FlatAppearance.BorderSize = 0;
            loadFromEnvBtn.Click += (s, e) => LoadFromEnv();
            buttonsLayout.Controls.Add(loadFromEnvBtn);
        }

        private void SetupSqlTab(TabPage page)
        {
            var mainLayout = new TableLayoutPanel()
            {
                Dock = DockStyle.Fill,
                ColumnCount = 1,
                RowCount = 4,
                Padding = new Padding(15)
            };
            mainLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 45));  // Warning banner
            mainLayout.RowStyles.Add(new RowStyle(SizeType.Percent, 30));   // Input editor
            mainLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 40));  // Execute actions
            mainLayout.RowStyles.Add(new RowStyle(SizeType.Percent, 70));   // Data grid
            page.Controls.Add(mainLayout);

            // Warning Banner
            var banner = new Label()
            {
                Text = "⚠️ SEGURANÇA: Apenas consultas SELECT ou WITH (leitura) são autorizadas. DELETE, UPDATE, DROP, ALTER, CREATE, etc. serão bloqueadas.",
                BackColor = Color.FromArgb(120, 113, 108, 30), // Translucent amber/stone
                ForeColor = Color.FromArgb(253, 224, 71), // Yellow-300
                Font = new Font("Segoe UI", 9f, FontStyle.Bold),
                Dock = DockStyle.Fill,
                TextAlign = ContentAlignment.MiddleCenter,
                BorderStyle = BorderStyle.FixedSingle
            };
            mainLayout.Controls.Add(banner, 0, 0);

            // Input SQL RichTextBox
            _sqlTextBox = new RichTextBox()
            {
                Dock = DockStyle.Fill,
                BackColor = Color.FromArgb(2, 6, 23),
                ForeColor = Color.FromArgb(52, 211, 153), // Emerald-400
                Font = new Font("Consolas", 10f),
                BorderStyle = BorderStyle.None,
                Text = "SELECT * FROM empresa LIMIT 10;"
            };
            mainLayout.Controls.Add(_sqlTextBox, 0, 1);

            // Actions panel
            var actionsLayout = new FlowLayoutPanel()
            {
                Dock = DockStyle.Fill,
                FlowDirection = FlowDirection.RightToLeft,
                Padding = new Padding(0, 5, 0, 0)
            };
            mainLayout.Controls.Add(actionsLayout, 0, 2);

            var runBtn = new Button()
            {
                Text = "Executar Consulta SQL",
                Width = 180,
                Height = 30,
                BackColor = Color.FromArgb(16, 185, 129),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9f, FontStyle.Bold)
            };
            runBtn.FlatAppearance.BorderSize = 0;
            runBtn.Click += async (s, e) => await ExecuteSql();
            actionsLayout.Controls.Add(runBtn);

            // Results Grid
            _sqlGrid = new DataGridView()
            {
                Dock = DockStyle.Fill,
                ReadOnly = true,
                AllowUserToAddRows = false,
                AllowUserToDeleteRows = false,
                BackgroundColor = Color.FromArgb(2, 6, 23),
                ForeColor = Color.Black, // Text color inside grid cells
                BorderStyle = BorderStyle.None,
                AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill
            };
            
            // Grid style adjustments
            _sqlGrid.ColumnHeadersDefaultCellStyle.BackColor = Color.FromArgb(30, 41, 59);
            _sqlGrid.ColumnHeadersDefaultCellStyle.ForeColor = Color.White;
            _sqlGrid.EnableHeadersVisualStyles = false;
            
            mainLayout.Controls.Add(_sqlGrid, 0, 3);
        }

        private void SetupSecurityTab(TabPage page)
        {
            var layout = new TableLayoutPanel()
            {
                Dock = DockStyle.Fill,
                ColumnCount = 2,
                RowCount = 5,
                Padding = new Padding(30)
            };
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 30));
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 70));
            page.Controls.Add(layout);

            var header = new Label()
            {
                Text = "Alterar Senha Administrativa do DBConfig",
                Font = new Font("Segoe UI", 11f, FontStyle.Bold),
                ForeColor = Color.White,
                AutoSize = true,
                Margin = new Padding(0, 0, 0, 20)
            };
            layout.Controls.Add(header, 0, 0);
            layout.SetColumnSpan(header, 2);

            AddFormRow(layout, 1, "Senha Atual:", _currentPassTextBox = CreateInput("", true));
            AddFormRow(layout, 2, "Nova Senha:", _newPassTextBox = CreateInput("", true));
            AddFormRow(layout, 3, "Confirmar Nova Senha:", _confirmPassTextBox = CreateInput("", true));

            var saveBtn = new Button()
            {
                Text = "Alterar Senha",
                Width = 140,
                Height = 35,
                BackColor = Color.FromArgb(16, 185, 129),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat
            };
            saveBtn.FlatAppearance.BorderSize = 0;
            saveBtn.Click += (s, e) => ChangeAdminPassword();
            
            var btnContainer = new FlowLayoutPanel() { Dock = DockStyle.Fill, Padding = new Padding(0, 15, 0, 0) };
            btnContainer.Controls.Add(saveBtn);
            layout.Controls.Add(btnContainer, 1, 4);
        }

        private TextBox CreateInput(string placeholder = "", bool isPassword = false)
        {
            return new TextBox()
            {
                Dock = DockStyle.Fill,
                BackColor = Color.FromArgb(2, 6, 23),
                ForeColor = Color.White,
                BorderStyle = BorderStyle.FixedSingle,
                Font = new Font("Segoe UI", 10f),
                PlaceholderText = placeholder,
                UseSystemPasswordChar = isPassword
            };
        }

        private void AddFormRow(TableLayoutPanel layout, int row, string labelText, TextBox inputControl)
        {
            var label = new Label()
            {
                Text = labelText,
                ForeColor = Color.FromArgb(148, 163, 184),
                Anchor = AnchorStyles.Left | AnchorStyles.Right,
                AutoSize = true
            };
            layout.Controls.Add(label, 0, row);
            layout.Controls.Add(inputControl, 1, row);
        }

        // Active Connection Info
        private void LoadActiveConnectionInfo()
        {
            if (!File.Exists(_envFile)) return;

            try
            {
                string[] lines = File.ReadAllLines(_envFile);
                string activeUrl = "";
                foreach (var line in lines)
                {
                    var match = Regex.Match(line, @"^\s*VITE_SUPABASE_URL\s*=\s*""?(.*?)""?\s*$");
                    if (match.Success)
                    {
                        activeUrl = match.Groups[1].Value.Trim();
                        break;
                    }
                }

                if (!string.IsNullOrEmpty(activeUrl))
                {
                    _sqlInfoLabel.Text = $"Conexão ativa no .env: {activeUrl}";
                    _sqlInfoLabel.ForeColor = Color.FromArgb(52, 211, 153);
                }
            }
            catch
            {
                // Ignore errors reading .env
            }
        }

        // Profiles Loading/Saving
        private void LoadProfiles()
        {
            if (!File.Exists(_connectionsFile)) return;

            try
            {
                string content = File.ReadAllText(_connectionsFile).Trim();
                string? decrypted = CryptoHelper.Decrypt(content);
                if (string.IsNullOrEmpty(decrypted)) return;

                _profiles = JsonSerializer.Deserialize<List<ConnectionProfile>>(decrypted) ?? new();
                UpdateProfilesListBox();
            }
            catch
            {
                // Ignore load errors
            }
        }

        private void UpdateProfilesListBox()
        {
            _profilesListBox.Items.Clear();
            foreach (var p in _profiles)
            {
                _profilesListBox.Items.Add(p.name);
            }
        }

        private void OnProfileSelected()
        {
            int index = _profilesListBox.SelectedIndex;
            if (index < 0 || index >= _profiles.Count) return;

            _selectedProfile = _profiles[index];
            _profileNameTextBox.Text = _selectedProfile.name;
            _supabaseUrlTextBox.Text = _selectedProfile.VITE_SUPABASE_URL;
            _supabaseKeyTextBox.Text = _selectedProfile.VITE_SUPABASE_PUBLISHABLE_KEY;
            _dbPasswordTextBox.Text = _selectedProfile.dbPassword ?? "";
            _dbPortTextBox.Text = _selectedProfile.dbPort ?? "5432";
            _dbNameTextBox.Text = _selectedProfile.dbName ?? "postgres";
            _dbUserTextBox.Text = _selectedProfile.dbUser ?? "postgres";
        }

        private void ClearForm()
        {
            _selectedProfile = null;
            _profilesListBox.ClearSelected();
            _profileNameTextBox.Clear();
            _supabaseUrlTextBox.Clear();
            _supabaseKeyTextBox.Clear();
            _dbPasswordTextBox.Clear();
            _dbPortTextBox.Text = "5432";
            _dbNameTextBox.Text = "postgres";
            _dbUserTextBox.Text = "postgres";
        }

        private void SaveProfile()
        {
            string name = _profileNameTextBox.Text.Trim();
            string url = _supabaseUrlTextBox.Text.Trim();
            string key = _supabaseKeyTextBox.Text.Trim();

            if (string.IsNullOrEmpty(name) || string.IsNullOrEmpty(url) || string.IsNullOrEmpty(key))
            {
                MessageBox.Show("Preencha o Nome do Perfil, a URL e a Chave Anon.", "Aviso", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            if (_selectedProfile == null)
            {
                _selectedProfile = new ConnectionProfile() { id = Guid.NewGuid().ToString() };
                _profiles.Add(_selectedProfile);
            }

            _selectedProfile.name = name;
            _selectedProfile.VITE_SUPABASE_URL = url;
            _selectedProfile.VITE_SUPABASE_PUBLISHABLE_KEY = key;
            _selectedProfile.dbPassword = _dbPasswordTextBox.Text.Trim();
            _selectedProfile.dbPort = _dbPortTextBox.Text.Trim();
            _selectedProfile.dbName = _dbNameTextBox.Text.Trim();
            _selectedProfile.dbUser = _dbUserTextBox.Text.Trim();

            SaveProfilesToFile();
            UpdateProfilesListBox();
            _profilesListBox.SelectedItem = name;

            MessageBox.Show("Perfil de conexão salvo!", "Sucesso", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }

        private void DeleteProfile()
        {
            if (_selectedProfile == null) return;

            var result = MessageBox.Show($"Deseja realmente excluir o perfil '{_selectedProfile.name}'?", "Excluir Perfil", MessageBoxButtons.YesNo, MessageBoxIcon.Question);
            if (result == DialogResult.Yes)
            {
                _profiles.Remove(_selectedProfile);
                SaveProfilesToFile();
                ClearForm();
                UpdateProfilesListBox();
            }
        }

        private void SaveProfilesToFile()
        {
            try
            {
                string json = JsonSerializer.Serialize(_profiles);
                string encrypted = CryptoHelper.Encrypt(json);
                CryptoHelper.ClearFileAttributes(_connectionsFile);
                File.WriteAllText(_connectionsFile, encrypted);
                CryptoHelper.HideFile(_connectionsFile);
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Erro ao gravar perfis no arquivo: {ex.Message}", "Erro", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        // Test Supabase Connection (HTTP request)
        private async Task TestConnection()
        {
            string url = _supabaseUrlTextBox.Text.Trim();
            string key = _supabaseKeyTextBox.Text.Trim();

            if (string.IsNullOrEmpty(url) || string.IsNullOrEmpty(key))
            {
                MessageBox.Show("Preencha a URL e a Chave do Supabase para efetuar o teste.", "Aviso", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            try
            {
                using (var client = new HttpClient())
                {
                    client.Timeout = TimeSpan.FromSeconds(10);
                    // Standard Supabase REST select to test
                    string requestUrl = $"{url.TrimEnd('/')}/rest/v1/empresa?select=razao_social&limit=1";
                    
                    var request = new HttpRequestMessage(HttpMethod.Get, requestUrl);
                    request.Headers.Add("apikey", key);
                    request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", key);

                    var response = await client.SendAsync(request);
                    if (response.IsSuccessStatusCode)
                    {
                        string body = await response.Content.ReadAsStringAsync();
                        // Parse JSON response dynamically to show company name
                        string companyName = "(Nenhuma empresa cadastrada)";
                        try
                        {
                            using (var doc = JsonDocument.Parse(body))
                            {
                                if (doc.RootElement.ValueKind == JsonValueKind.Array && doc.RootElement.GetArrayLength() > 0)
                                {
                                    companyName = doc.RootElement[0].GetProperty("razao_social").GetString() ?? companyName;
                                }
                            }
                        }
                        catch { }

                        MessageBox.Show($"Conexão estabelecida com sucesso!\nBanco respondendo.\nEmpresa vinculada: {companyName}", "Conexão OK", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    }
                    else
                    {
                        MessageBox.Show($"Erro retornado pela API do Supabase:\nStatus: {response.StatusCode} - {response.ReasonPhrase}", "Falha de Conexão", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    }
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Falha de conectividade HTTP:\n{ex.Message}", "Falha de Conexão", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        // Apply Configuration to .env file
        private void ApplyToEnv()
        {
            string url = _supabaseUrlTextBox.Text.Trim();
            string key = _supabaseKeyTextBox.Text.Trim();

            if (string.IsNullOrEmpty(url) || string.IsNullOrEmpty(key))
            {
                MessageBox.Show("Configure ou selecione um perfil completo.", "Aviso", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            try
            {
                // Auto-extract Project ID from Supabase URL
                string projectId = "";
                var match = Regex.Match(url, @"https://([a-z0-9\-]+)\.supabase\.(co|in|net)");
                if (match.Success)
                {
                    projectId = match.Groups[1].Value;
                }

                // Prepare env strings
                var sb = new StringBuilder();
                sb.AppendLine($"SUPABASE_PUBLISHABLE_KEY=\"{key}\"");
                sb.AppendLine($"SUPABASE_URL=\"{url}\"");
                sb.AppendLine($"VITE_SUPABASE_PROJECT_ID=\"{projectId}\"");
                sb.AppendLine($"VITE_SUPABASE_PUBLISHABLE_KEY=\"{key}\"");
                sb.AppendLine($"VITE_SUPABASE_URL=\"{url}\"");

                CryptoHelper.ClearFileAttributes(_envFile);
                File.WriteAllText(_envFile, sb.ToString());
                CryptoHelper.HideFile(_envFile);
                LoadActiveConnectionInfo();

                MessageBox.Show("Arquivo .env atualizado com sucesso!", "Sucesso", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Erro ao gravar arquivo .env:\n{ex.Message}", "Erro", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        // Load Configuration from .env file
        private void LoadFromEnv()
        {
            if (!File.Exists(_envFile))
            {
                MessageBox.Show("Arquivo .env não encontrado na pasta do projeto.", "Aviso", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            try
            {
                string[] lines = File.ReadAllLines(_envFile);
                string? url = null;
                string? key = null;
                string? dbPassword = null;
                string? dbPort = null;
                string? dbName = null;
                string? dbUser = null;

                foreach (var line in lines)
                {
                    var trimmed = line.Trim();
                    if (trimmed.StartsWith("#") || !trimmed.Contains("=")) continue;

                    var parts = trimmed.Split(new[] { '=' }, 2);
                    var varName = parts[0].Trim().ToUpper();
                    var varVal = parts[1].Trim().Trim('"').Trim('\'').Trim();

                    if (varName == "VITE_SUPABASE_URL" || (varName == "SUPABASE_URL" && string.IsNullOrEmpty(url)))
                    {
                        url = varVal;
                    }
                    else if (varName == "VITE_SUPABASE_PUBLISHABLE_KEY" || (varName == "SUPABASE_PUBLISHABLE_KEY" && string.IsNullOrEmpty(key)))
                    {
                        key = varVal;
                    }
                    else if (varName == "DB_PASSWORD" || varName == "POSTGRES_PASSWORD" || varName == "SUPABASE_DB_PASSWORD")
                    {
                        dbPassword = varVal;
                    }
                    else if (varName == "DB_PORT" || varName == "POSTGRES_PORT" || varName == "SUPABASE_DB_PORT")
                    {
                        dbPort = varVal;
                    }
                    else if (varName == "DB_NAME" || varName == "POSTGRES_DB" || varName == "SUPABASE_DB_NAME")
                    {
                        dbName = varVal;
                    }
                    else if (varName == "DB_USER" || varName == "POSTGRES_USER" || varName == "SUPABASE_DB_USER")
                    {
                        dbUser = varVal;
                    }
                }

                if (string.IsNullOrEmpty(url) && string.IsNullOrEmpty(key))
                {
                    MessageBox.Show("Nenhuma variável de URL ou Chave do Supabase foi encontrada no .env.", "Aviso", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    return;
                }

                _profileNameTextBox.Text = "Importado do .env";
                if (!string.IsNullOrEmpty(url)) _supabaseUrlTextBox.Text = url;
                if (!string.IsNullOrEmpty(key)) _supabaseKeyTextBox.Text = key;
                if (!string.IsNullOrEmpty(dbPassword)) _dbPasswordTextBox.Text = dbPassword;
                _dbPortTextBox.Text = !string.IsNullOrEmpty(dbPort) ? dbPort : "5432";
                _dbNameTextBox.Text = !string.IsNullOrEmpty(dbName) ? dbName : "postgres";
                _dbUserTextBox.Text = !string.IsNullOrEmpty(dbUser) ? dbUser : "postgres";

                MessageBox.Show("Dados do .env carregados com sucesso nos campos da interface!\n\nLembre-se de clicar em 'Salvar Perfil' caso queira persistir estes dados em um perfil local.", "Importação Concluída", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Erro ao carregar dados do arquivo .env:\n{ex.Message}", "Erro", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        // Execute SQL query directly via Postgres Client
        private async Task ExecuteSql()
        {
            string query = _sqlTextBox.Text.Trim();
            if (string.IsNullOrEmpty(query)) return;

            string url = _supabaseUrlTextBox.Text.Trim();
            string password = _dbPasswordTextBox.Text.Trim();
            string port = _dbPortTextBox.Text.Trim();
            string dbName = _dbNameTextBox.Text.Trim();
            string user = _dbUserTextBox.Text.Trim();

            if (string.IsNullOrEmpty(password))
            {
                MessageBox.Show("Defina a Senha do Banco (Postgres) no perfil atual para poder rodar consultas SQL.", "Aviso", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            // Verify Query safety (SELECT/WITH only)
            string cleanQuery = query.ToLower();
            var forbiddenRegex = new Regex(@"\b(delete|update|drop|alter|create|insert|truncate|replace|grant|revoke)\b", RegexOptions.IgnoreCase);
            if (forbiddenRegex.IsMatch(cleanQuery))
            {
                MessageBox.Show("Comando bloqueado. Apenas consultas de leitura (SELECT ou WITH) são permitidas.", "Bloqueado", MessageBoxButtons.OK, MessageBoxIcon.Stop);
                return;
            }

            if (!cleanQuery.StartsWith("select") && !cleanQuery.StartsWith("with") && !cleanQuery.StartsWith("show") && !cleanQuery.StartsWith("explain"))
            {
                MessageBox.Show("Comando bloqueado. A consulta deve iniciar com SELECT ou WITH.", "Bloqueado", MessageBoxButtons.OK, MessageBoxIcon.Stop);
                return;
            }

            // Derive db host from Supabase URL
            string dbHost = "";
            var match = Regex.Match(url, @"https://([a-z0-9\-]+)\.supabase\.(co|in|net)");
            if (match.Success)
            {
                dbHost = $"db.{match.Groups[1].Value}.supabase.co";
            }
            else if (url.Contains("127.0.0.1") || url.Contains("localhost"))
            {
                dbHost = "127.0.0.1";
            }
            else
            {
                try
                {
                    var uri = new Uri(url);
                    dbHost = uri.Host;
                }
                catch
                {
                    MessageBox.Show("Não foi possível identificar o host do banco de dados a partir da URL do Supabase.", "Erro", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return;
                }
            }

            _sqlGrid.DataSource = null;

            try
            {
                string sslMode = (dbHost == "127.0.0.1" || dbHost == "localhost") ? "Disable" : "Require";
                string connString = $"Host={dbHost};Port={port};Database={dbName};Username={user};Password={password};SSL Mode={sslMode};Trust Server Certificate=true;Command Timeout=15";
                
                using (var conn = new NpgsqlConnection(connString))
                {
                    await conn.OpenAsync();
                    using (var cmd = new NpgsqlCommand(query, conn))
                    {
                        using (var reader = await cmd.ExecuteReaderAsync())
                        {
                            var dt = new DataTable();
                            dt.Load(reader);
                            _sqlGrid.DataSource = dt;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Erro na execução do SQL:\n{ex.Message}", "Erro no Banco", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        // Change Admin Password
        private void ChangeAdminPassword()
        {
            string currentPassword = _currentPassTextBox.Text;
            string newPassword = _newPassTextBox.Text;
            string confirmPassword = _confirmPassTextBox.Text;

            if (string.IsNullOrEmpty(currentPassword) || string.IsNullOrEmpty(newPassword) || string.IsNullOrEmpty(confirmPassword))
            {
                MessageBox.Show("Preencha todos os campos de senha.", "Aviso", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            if (newPassword != confirmPassword)
            {
                MessageBox.Show("A nova senha e a confirmação não coincidem.", "Aviso", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            string expectedPassword = GetCurrentAdminPassword();
            if (currentPassword != expectedPassword)
            {
                MessageBox.Show("Senha atual incorreta.", "Aviso", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            try
            {
                string encrypted = CryptoHelper.Encrypt(newPassword);
                CryptoHelper.ClearFileAttributes(_configFile);
                File.WriteAllText(_configFile, encrypted);
                CryptoHelper.HideFile(_configFile);

                _currentPassTextBox.Clear();
                _newPassTextBox.Clear();
                _confirmPassTextBox.Clear();

                MessageBox.Show("Senha de administrador alterada com sucesso!", "Sucesso", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Erro ao atualizar senha:\n{ex.Message}", "Erro", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private string GetCurrentAdminPassword()
        {
            try
            {
                if (File.Exists(_configFile))
                {
                    string content = File.ReadAllText(_configFile).Trim();
                    string? decrypted = CryptoHelper.Decrypt(content);
                    if (decrypted != null) return decrypted;
                }
            }
            catch { }
            return "S0ftw@y1";
        }
    }

    public class ConnectionProfile
    {
        public string id { get; set; } = Guid.NewGuid().ToString();
        public string name { get; set; } = "";
        public string VITE_SUPABASE_URL { get; set; } = "";
        public string VITE_SUPABASE_PUBLISHABLE_KEY { get; set; } = "";
        public string? dbPassword { get; set; }
        public string? dbPort { get; set; }
        public string? dbName { get; set; }
        public string? dbUser { get; set; }
    }
}

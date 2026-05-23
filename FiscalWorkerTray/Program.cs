using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Windows.Forms;

namespace FiscalWorkerTray
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            try
            {
                ApplicationConfiguration.Initialize();
                Application.Run(new TrayApplicationContext());
            }
            catch (Exception ex)
            {
                string logPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "FiscalWorkerTrayCrash.log");
                File.WriteAllText(logPath, ex.ToString());
            }
        }
    }

    public class TrayApplicationContext : ApplicationContext
    {
        private NotifyIcon _notifyIcon;
        private LogForm _logForm;
        private Process? _workerProcess;
        private bool _isExiting = false;

        public TrayApplicationContext()
        {
            // Initialize forms
            _logForm = new LogForm(this);
            
            // Force handle creation so BeginInvoke/Invoke can be called safely from background streams
            _ = _logForm.Handle;

            // Setup Notify Icon (System Tray)
            _notifyIcon = new NotifyIcon()
            {
                Icon = SystemIcons.Application, // Use default system icon
                Text = "Realcommerce - Servidor Fiscal",
                Visible = true
            };

            // Setup Context Menu for Tray Icon
            var contextMenu = new ContextMenuStrip();
            contextMenu.Items.Add("Mostrar Logs", null, (s, e) => ShowLogs());
            contextMenu.Items.Add("Reiniciar Serviço", null, (s, e) => RestartWorker());
            contextMenu.Items.Add("-");
            contextMenu.Items.Add("Sair", null, (s, e) => ExitApplication());

            _notifyIcon.ContextMenuStrip = contextMenu;
            _notifyIcon.DoubleClick += (s, e) => ShowLogs();

            // Start background worker process
            StartWorker();
        }

        public void ShowLogs()
        {
            _logForm.Show();
            _logForm.WindowState = FormWindowState.Normal;
            _logForm.Activate();
        }

        public void StartWorker()
        {
            try
            {
                if (_workerProcess != null && !_workerProcess.HasExited)
                {
                    return;
                }

                _logForm.AppendLog("Iniciando processo do Servidor Fiscal...");

                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string fiscalWorkerDir = Path.Combine(baseDir, "fiscal-worker");
                
                if (!Directory.Exists(fiscalWorkerDir))
                {
                    string parentDir = Path.GetFullPath(Path.Combine(baseDir, ".."));
                    fiscalWorkerDir = Path.Combine(parentDir, "fiscal-worker");
                }
                
                if (!Directory.Exists(fiscalWorkerDir))
                {
                    fiscalWorkerDir = baseDir; // Assume same directory as executable
                }

                string exePath = Path.Combine(fiscalWorkerDir, "fiscal-worker.exe");
                string jsPath = Path.Combine(fiscalWorkerDir, "src", "index.js");

                var startInfo = new ProcessStartInfo();
                startInfo.UseShellExecute = false;
                startInfo.RedirectStandardOutput = true;
                startInfo.RedirectStandardError = true;
                startInfo.CreateNoWindow = true;
                startInfo.WorkingDirectory = fiscalWorkerDir;

                if (File.Exists(exePath))
                {
                    _logForm.AppendLog($"Executando arquivo compilado: {exePath}");
                    startInfo.FileName = exePath;
                }
                else if (Directory.Exists(fiscalWorkerDir) && File.Exists(jsPath))
                {
                    _logForm.AppendLog($"Executando código-fonte Node: {jsPath}");
                    startInfo.FileName = "node";
                    startInfo.Arguments = "--openssl-legacy-provider src/index.js";
                }
                else
                {
                    _logForm.AppendLog("ERRO: Arquivo 'fiscal-worker.exe' ou 'src/index.js' não foi encontrado. Verifique se o executável ou os arquivos fonte estão no local correto.");
                    _logForm.SetStatus("Desconectado (Arquivos não encontrados)", Color.Red);
                    return;
                }

                _workerProcess = new Process();
                _workerProcess.StartInfo = startInfo;
                _workerProcess.EnableRaisingEvents = true;

                // Handle process exit
                _workerProcess.Exited += (s, e) =>
                {
                    if (!_isExiting)
                    {
                        _logForm.BeginInvoke(new Action(() =>
                        {
                            _logForm.AppendLog("AVISO: O processo do Servidor Fiscal foi encerrado. Tentando reiniciar em 5 segundos...");
                            _logForm.SetStatus("Encerrado (Reiniciando...)", Color.Orange);
                            
                            // Auto-restart timer
                            var timer = new System.Windows.Forms.Timer();
                            timer.Interval = 5000;
                            timer.Tick += (ts, te) =>
                            {
                                timer.Stop();
                                if (!_isExiting) StartWorker();
                            };
                            timer.Start();
                        }));
                    }
                };

                // Read output asynchronously
                _workerProcess.OutputDataReceived += (s, e) =>
                {
                    if (e.Data != null)
                    {
                        _logForm.BeginInvoke(new Action(() => _logForm.AppendLog(e.Data)));
                    }
                };

                _workerProcess.ErrorDataReceived += (s, e) =>
                {
                    if (e.Data != null)
                    {
                        _logForm.BeginInvoke(new Action(() => _logForm.AppendLog($"[ERRO] {e.Data}")));
                    }
                };

                _workerProcess.Start();
                _workerProcess.BeginOutputReadLine();
                _workerProcess.BeginErrorReadLine();

                _logForm.SetStatus("Servidor Fiscal: Ativo e Escutando...", Color.Green);
            }
            catch (Exception ex)
            {
                _logForm.AppendLog($"FALHA AO INICIAR PROCESSO: {ex.Message}");
                _logForm.SetStatus("Erro de Inicialização", Color.Red);
            }
        }

        public void RestartWorker()
        {
            StopWorker();
            StartWorker();
        }

        private void StopWorker()
        {
            if (_workerProcess != null && !_workerProcess.HasExited)
            {
                _logForm.AppendLog("Encerrando processo do Servidor Fiscal...");
                try
                {
                    _workerProcess.Kill(true);
                    _workerProcess.WaitForExit(3000);
                }
                catch (Exception ex)
                {
                    _logForm.AppendLog($"Erro ao parar processo: {ex.Message}");
                }
            }
        }

        public void ExitApplication()
        {
            _isExiting = true;
            StopWorker();
            _notifyIcon.Visible = false;
            Application.Exit();
        }
    }

    public class LogForm : Form
    {
        private TrayApplicationContext _context;
        private RichTextBox _logBox;
        private Label _statusLabel;
        private Panel _statusDot;

        public LogForm(TrayApplicationContext context)
        {
            _context = context;

            // Form properties
            this.Text = "Realcommerce - Console do Servidor Fiscal";
            this.Size = new Size(700, 480);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.FromArgb(15, 23, 42); // Dark slate
            this.ForeColor = Color.FromArgb(241, 245, 249);
            this.Font = new Font("Segoe UI", 9.5f);
            this.Icon = SystemIcons.Application;

            // Form layout
            var mainLayout = new TableLayoutPanel()
            {
                Dock = DockStyle.Fill,
                ColumnCount = 1,
                RowCount = 3,
                Padding = new Padding(15),
            };
            mainLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 45)); // Header
            mainLayout.RowStyles.Add(new RowStyle(SizeType.Percent, 100)); // Log box
            mainLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 50)); // Actions Panel
            this.Controls.Add(mainLayout);

            // Header layout
            var headerLayout = new FlowLayoutPanel()
            {
                Dock = DockStyle.Fill,
                FlowDirection = FlowDirection.LeftToRight,
                WrapContents = false
            };
            mainLayout.Controls.Add(headerLayout, 0, 0);

            _statusDot = new Panel()
            {
                Size = new Size(12, 12),
                BackColor = Color.Gray,
                Margin = new Padding(0, 5, 8, 0)
            };
            // Make dot round
            var path = new System.Drawing.Drawing2D.GraphicsPath();
            path.AddEllipse(0, 0, 12, 12);
            _statusDot.Region = new Region(path);
            headerLayout.Controls.Add(_statusDot);

            _statusLabel = new Label()
            {
                Text = "Carregando Status...",
                AutoSize = true,
                Font = new Font("Segoe UI", 10.5f, FontStyle.Bold),
                ForeColor = Color.White
            };
            headerLayout.Controls.Add(_statusLabel);

            // Logs text box
            _logBox = new RichTextBox()
            {
                Dock = DockStyle.Fill,
                ReadOnly = true,
                BackColor = Color.FromArgb(2, 6, 23), // Very dark blue/black
                ForeColor = Color.FromArgb(52, 211, 153), // Emerald green console color
                Font = new Font("Consolas", 9.5f),
                BorderStyle = BorderStyle.None,
            };
            mainLayout.Controls.Add(_logBox, 0, 1);

            // Footer layout (Buttons)
            var footerLayout = new FlowLayoutPanel()
            {
                Dock = DockStyle.Fill,
                FlowDirection = FlowDirection.RightToLeft,
                Padding = new Padding(0, 10, 0, 0)
            };
            mainLayout.Controls.Add(footerLayout, 0, 2);

            var closeButton = new Button()
            {
                Text = "Fechar Janela",
                Width = 110,
                Height = 30,
                BackColor = Color.FromArgb(30, 41, 59),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat
            };
            closeButton.FlatAppearance.BorderSize = 0;
            closeButton.Click += (s, e) => this.Hide();
            footerLayout.Controls.Add(closeButton);

            var restartButton = new Button()
            {
                Text = "Reiniciar Serviço",
                Width = 130,
                Height = 30,
                BackColor = Color.FromArgb(220, 38, 38), // Red
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat
            };
            restartButton.FlatAppearance.BorderSize = 0;
            restartButton.Click += (s, e) => _context.RestartWorker();
            footerLayout.Controls.Add(restartButton);

            var clearButton = new Button()
            {
                Text = "Limpar Logs",
                Width = 110,
                Height = 30,
                BackColor = Color.FromArgb(30, 41, 59),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat
            };
            clearButton.FlatAppearance.BorderSize = 0;
            clearButton.Click += (s, e) => _logBox.Clear();
            footerLayout.Controls.Add(clearButton);

            // Intercept window close to minimize to tray instead
            this.FormClosing += (s, e) =>
            {
                if (e.CloseReason == CloseReason.UserClosing)
                {
                    e.Cancel = true;
                    this.Hide();
                }
            };
        }

        public void SetStatus(string text, Color color)
        {
            _statusLabel.Text = text;
            _statusDot.BackColor = color;
        }

        public void AppendLog(string text)
        {
            if (string.IsNullOrEmpty(text)) return;
            
            // Format log entries with timestamp
            string timestamp = DateTime.Now.ToString("HH:mm:ss");
            _logBox.AppendText($"[{timestamp}] {text}\n");
            
            // Scroll to bottom
            _logBox.SelectionStart = _logBox.Text.Length;
            _logBox.ScrollToCaret();

            // Limit logs size in memory (keep last 1000 lines)
            if (_logBox.Lines.Length > 1000)
            {
                string[] lines = _logBox.Lines;
                string[] newLines = new string[500];
                Array.Copy(lines, lines.Length - 500, newLines, 0, 500);
                _logBox.Lines = newLines;
            }
        }
    }
}

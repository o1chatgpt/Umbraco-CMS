// Copyright (c) Umbraco.
// See LICENSE for more details.

using System;
using System.Collections.Generic;
using System.Data.Common;
using System.Data.SqlClient;
using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using NUnit.Framework;
using Serilog;
using Umbraco.Core;
using Umbraco.Core.Cache;
using Umbraco.Core.Configuration.Models;
using Umbraco.Core.DependencyInjection;
using Umbraco.Core.IO;
using Umbraco.Core.Persistence;
using Umbraco.Core.Persistence.Mappers;
using Umbraco.Core.Runtime;
using Umbraco.Core.Scoping;
using Umbraco.Core.Strings;
using Umbraco.Extensions;
using Umbraco.Infrastructure.DependencyInjection;
using Umbraco.Infrastructure.PublishedCache.DependencyInjection;
using Umbraco.Tests.Common.Builders;
using Umbraco.Tests.Integration.DependencyInjection;
using Umbraco.Tests.Integration.Extensions;
using Umbraco.Tests.Integration.Implementations;
using Umbraco.Tests.Integration.TestServerTest;
using Umbraco.Tests.Testing;
using Umbraco.Web;
using Umbraco.Web.BackOffice.DependencyInjection;
using Umbraco.Web.Common.DependencyInjection;

namespace Umbraco.Tests.Integration.Testing
{
    /// <summary>
    /// Abstract class for integration tests
    /// </summary>
    /// <remarks>
    /// This will use a Host Builder to boot and install Umbraco ready for use
    /// </remarks>
    [SingleThreaded]
    [NonParallelizable]
    public abstract class UmbracoIntegrationTest
    {
        private List<Action> _testTeardown = null;
        private readonly List<Action> _fixtureTeardown = new List<Action>();

        public void OnTestTearDown(Action tearDown)
        {
            if (_testTeardown == null)
            {
                _testTeardown = new List<Action>();
            }

            _testTeardown.Add(tearDown);
        }

        public void OnFixtureTearDown(Action tearDown) => _fixtureTeardown.Add(tearDown);

        [OneTimeTearDown]
        public void FixtureTearDown()
        {
            foreach (Action a in _fixtureTeardown)
            {
                a();
            }
        }

        [TearDown]
        public async Task TearDownAsync()
        {
            if (_testTeardown != null)
            {
                foreach (Action a in _testTeardown)
                {
                    a();
                }
            }

            _testTeardown = null;
            FirstTestInFixture = false;
            FirstTestInSession = false;

            // Ensure CoreRuntime stopped (now it's a HostedService)
            IHost host = Services.GetRequiredService<IHost>();
            await host.StopAsync();
            host.Dispose();
        }

        [TearDown]
        public virtual void TearDown_Logging() =>
            TestContext.Progress.Write($"  {TestContext.CurrentContext.Result.Outcome.Status}");

        [SetUp]
        public virtual void SetUp_Logging() =>
            TestContext.Progress.Write($"Start test {TestCount++}: {TestContext.CurrentContext.Test.Name}");

        [SetUp]
        public virtual void Setup()
        {
            InMemoryConfiguration[Constants.Configuration.ConfigGlobal + ":" + nameof(GlobalSettings.InstallUnattended)] = "true";
            IHostBuilder hostBuilder = CreateHostBuilder();

            IHost host = hostBuilder.Build();
            BeforeHostStart(host);
            host.Start();

            var app = new ApplicationBuilder(host.Services);
            Configure(app);
        }

        protected virtual void BeforeHostStart(IHost host)
        {
            Services = host.Services;
            UseTestDatabase(Services);
        }

        private ILoggerFactory CreateLoggerFactory()
        {
            try
            {
                switch (TestOptions.Logger)
                {
                    case UmbracoTestOptions.Logger.Mock:
                        return NullLoggerFactory.Instance;
                    case UmbracoTestOptions.Logger.Serilog:
                        return Microsoft.Extensions.Logging.LoggerFactory.Create(builder =>
                        {
                            string path = Path.Combine(TestHelper.WorkingDirectory, "logs", "umbraco_integration_tests_.txt");

                            Log.Logger = new LoggerConfiguration()
                                .WriteTo.File(path, rollingInterval: RollingInterval.Day)
                                .CreateLogger();

                            builder.AddSerilog(Log.Logger);
                        });
                    case UmbracoTestOptions.Logger.Console:
                        return Microsoft.Extensions.Logging.LoggerFactory.Create(builder => builder.AddConsole());
                }
            }
            catch
            {
                // ignored
            }

            return NullLoggerFactory.Instance;
        }

        /// <summary>
        /// Create the Generic Host and execute startup ConfigureServices/Configure calls
        /// </summary>
        public virtual IHostBuilder CreateHostBuilder()
        {
            IHostBuilder hostBuilder = Host.CreateDefaultBuilder()

                // IMPORTANT: We Cannot use UseStartup, there's all sorts of threads about this with testing. Although this can work
                // if you want to setup your tests this way, it is a bit annoying to do that as the WebApplicationFactory will
                // create separate Host instances. So instead of UseStartup, we just call ConfigureServices/Configure ourselves,
                // and in the case of the UmbracoTestServerTestBase it will use the ConfigureWebHost to Configure the IApplicationBuilder directly.
                // .ConfigureWebHostDefaults(webBuilder => { webBuilder.UseStartup(GetType()); })
                .ConfigureAppConfiguration((context, configBuilder) =>
                {
                    context.HostingEnvironment = TestHelper.GetWebHostEnvironment();
                    configBuilder.Sources.Clear();
                    configBuilder.AddInMemoryCollection(InMemoryConfiguration);

                    Configuration = configBuilder.Build();
                })
                .ConfigureServices((hostContext, services) =>
                {
                    ConfigureServices(services);
                    services.AddUnique(CreateLoggerFactory());

                    if (!TestOptions.Boot)
                    {
                        // If boot is false, we don't want the CoreRuntime hosted service to start
                        // So we replace it with a Mock
                        services.AddUnique(Mock.Of<IRuntime>());
                    }
                });
            return hostBuilder;
        }

        public virtual void ConfigureServices(IServiceCollection services)
        {
            services.AddSingleton(TestHelper.DbProviderFactoryCreator);
            services.AddTransient<TestUmbracoDatabaseFactoryProvider>();
            IWebHostEnvironment webHostEnvironment = TestHelper.GetWebHostEnvironment();
            services.AddRequiredNetCoreServices(TestHelper, webHostEnvironment);

            // Add it!
            Core.Composing.TypeLoader typeLoader = services.AddTypeLoader(
                GetType().Assembly,
                webHostEnvironment,
                TestHelper.GetHostingEnvironment(),
                TestHelper.ConsoleLoggerFactory,
                AppCaches.NoCache,
                Configuration,
                TestHelper.Profiler);
            var builder = new UmbracoBuilder(services, Configuration, typeLoader, TestHelper.ConsoleLoggerFactory);

            builder.Services.AddLogger(TestHelper.GetHostingEnvironment(), TestHelper.GetLoggingConfiguration(), Configuration);

            builder.AddConfiguration()
                .AddUmbracoCore()
                .AddWebComponents()
                .AddRuntimeMinifier()
                .AddBackOfficeAuthentication()
                .AddBackOfficeIdentity()
                .AddTestServices(TestHelper, GetAppCaches());

            if (TestOptions.Mapper)
            {
                // TODO: Should these just be called from within AddUmbracoCore/AddWebComponents?
                builder
                    .AddCoreMappingProfiles()
                    .AddWebMappingProfiles();
            }

            services.AddSignalR();
            builder.AddMembersIdentity();

            services.AddMvc();

            CustomTestSetup(builder);

            builder.Build();
        }

        protected virtual AppCaches GetAppCaches() =>

            // Disable caches for integration tests
            AppCaches.NoCache;

        public virtual void Configure(IApplicationBuilder app)
        {
            if (TestOptions.Boot)
            {
                Services.GetRequiredService<IBackOfficeSecurityFactory>().EnsureBackOfficeSecurity();
                Services.GetRequiredService<IUmbracoContextFactory>().EnsureUmbracoContext();
            }

            app.UseUmbracoCore(); // This no longer starts CoreRuntime, it's very fast
        }

        private static readonly object s_dbLocker = new object();
        private static ITestDatabase s_dbInstance;
        private static TestDbMeta s_fixtureDbMeta;

        protected void UseTestDatabase(IServiceProvider serviceProvider)
        {
            IRuntimeState state = serviceProvider.GetRequiredService<IRuntimeState>();
            TestUmbracoDatabaseFactoryProvider testDatabaseFactoryProvider = serviceProvider.GetRequiredService<TestUmbracoDatabaseFactoryProvider>();
            IUmbracoDatabaseFactory databaseFactory = serviceProvider.GetRequiredService<IUmbracoDatabaseFactory>();
            ILoggerFactory loggerFactory = serviceProvider.GetRequiredService<ILoggerFactory>();

            // This will create a db, install the schema and ensure the app is configured to run
            SetupTestDatabase(testDatabaseFactoryProvider, databaseFactory, loggerFactory, state, TestHelper.WorkingDirectory);
        }

        /// <summary>
        /// Get or create an instance of <see cref="ITestDatabase"/>
        /// </summary>
        /// <remarks>
        /// There must only be ONE instance shared between all tests in a session
        /// </remarks>
        private static ITestDatabase GetOrCreateDatabase(string filesPath, ILoggerFactory loggerFactory, TestUmbracoDatabaseFactoryProvider dbFactory)
        {
            lock (s_dbLocker)
            {
                if (s_dbInstance != null)
                {
                    return s_dbInstance;
                }

                s_dbInstance = TestDatabaseFactory.Create(filesPath, loggerFactory, dbFactory);

                return s_dbInstance;
            }
        }

        /// <summary>
        /// Creates a LocalDb instance to use for the test
        /// </summary>
        private void SetupTestDatabase(
            TestUmbracoDatabaseFactoryProvider testUmbracoDatabaseFactoryProvider,
            IUmbracoDatabaseFactory databaseFactory,
            ILoggerFactory loggerFactory,
            IRuntimeState runtimeState,
            string workingDirectory)
        {
            if (TestOptions.Database == UmbracoTestOptions.Database.None)
            {
                return;
            }

            // need to manually register this factory
            DbProviderFactories.RegisterFactory(Constants.DbProviderNames.SqlServer, SqlClientFactory.Instance);

            string dbFilePath = Path.Combine(workingDirectory, "LocalDb");

            ITestDatabase db = GetOrCreateDatabase(dbFilePath, loggerFactory, testUmbracoDatabaseFactoryProvider);

            switch (TestOptions.Database)
            {
                case UmbracoTestOptions.Database.NewSchemaPerTest:

                    // New DB + Schema
                    TestDbMeta newSchemaDbMeta = db.AttachSchema();

                    // Add teardown callback
                    OnTestTearDown(() => db.Detach(newSchemaDbMeta));

                    ConfigureTestDatabaseFactory(newSchemaDbMeta, databaseFactory, runtimeState);

                    Assert.AreEqual(RuntimeLevel.Run, runtimeState.Level);

                    break;
                case UmbracoTestOptions.Database.NewEmptyPerTest:
                    TestDbMeta newEmptyDbMeta = db.AttachEmpty();

                    // Add teardown callback
                    OnTestTearDown(() => db.Detach(newEmptyDbMeta));

                    ConfigureTestDatabaseFactory(newEmptyDbMeta, databaseFactory, runtimeState);

                    Assert.AreEqual(RuntimeLevel.Install, runtimeState.Level);

                    break;
                case UmbracoTestOptions.Database.NewSchemaPerFixture:
                    // Only attach schema once per fixture
                    // Doing it more than once will block the process since the old db hasn't been detached
                    // and it would be the same as NewSchemaPerTest even if it didn't block
                    if (FirstTestInFixture)
                    {
                        // New DB + Schema
                        TestDbMeta newSchemaFixtureDbMeta = db.AttachSchema();
                        s_fixtureDbMeta = newSchemaFixtureDbMeta;

                        // Add teardown callback
                        OnFixtureTearDown(() => db.Detach(newSchemaFixtureDbMeta));
                    }

                    ConfigureTestDatabaseFactory(s_fixtureDbMeta, databaseFactory, runtimeState);

                    break;
                case UmbracoTestOptions.Database.NewEmptyPerFixture:
                    // Only attach schema once per fixture
                    // Doing it more than once will block the process since the old db hasn't been detached
                    // and it would be the same as NewSchemaPerTest even if it didn't block
                    if (FirstTestInFixture)
                    {
                        // New DB + Schema
                        TestDbMeta newEmptyFixtureDbMeta = db.AttachEmpty();
                        s_fixtureDbMeta = newEmptyFixtureDbMeta;

                        // Add teardown callback
                        OnFixtureTearDown(() => db.Detach(newEmptyFixtureDbMeta));
                    }

                    ConfigureTestDatabaseFactory(s_fixtureDbMeta, databaseFactory, runtimeState);

                    break;
                default:
                    throw new ArgumentOutOfRangeException(nameof(TestOptions), TestOptions, null);
            }
        }

        private void ConfigureTestDatabaseFactory(TestDbMeta meta, IUmbracoDatabaseFactory factory, IRuntimeState state)
        {
            ILogger<UmbracoIntegrationTest> log = Services.GetRequiredService<ILogger<UmbracoIntegrationTest>>();
            log.LogInformation($"ConfigureTestDatabaseFactory - Using test database: [{meta.Name}] - IsEmpty: [{meta.IsEmpty}]");

            // It's just been pulled from container and wasn't used to create test database
            Assert.IsFalse(factory.Configured);

            factory.Configure(meta.ConnectionString, Constants.DatabaseProviders.SqlServer);
            state.DetermineRuntimeLevel();
            log.LogInformation($"ConfigureTestDatabaseFactory - Determined RuntimeLevel: [{state.Level}]");
        }

        protected UmbracoTestAttribute TestOptions => TestOptionAttributeBase.GetTestOptions<UmbracoTestAttribute>();

        protected virtual T GetRequiredService<T>() => Services.GetRequiredService<T>();

        public Dictionary<string, string> InMemoryConfiguration { get; } = new Dictionary<string, string>();

        public IConfiguration Configuration { get; protected set; }

        public TestHelper TestHelper { get; } = new TestHelper();

        protected virtual void CustomTestSetup(IUmbracoBuilder builder) { }

        /// <summary>
        /// Gets or sets the DI container.
        /// </summary>
        protected IServiceProvider Services { get; set; }

        /// <summary>
        /// Gets the <see cref="IScopeProvider"/>
        /// </summary>
        protected IScopeProvider ScopeProvider => Services.GetRequiredService<IScopeProvider>();

        /// <summary>
        /// Gets the <see cref="IScopeAccessor"/>
        /// </summary>
        protected IScopeAccessor ScopeAccessor => Services.GetRequiredService<IScopeAccessor>();

        /// <summary>
        /// Gets the <see cref="ILoggerFactory"/>
        /// </summary>
        protected ILoggerFactory LoggerFactory => Services.GetRequiredService<ILoggerFactory>();

        protected AppCaches AppCaches => Services.GetRequiredService<AppCaches>();

        protected IIOHelper IOHelper => Services.GetRequiredService<IIOHelper>();

        protected IShortStringHelper ShortStringHelper => Services.GetRequiredService<IShortStringHelper>();

        protected GlobalSettings GlobalSettings => Services.GetRequiredService<IOptions<GlobalSettings>>().Value;

        protected IMapperCollection Mappers => Services.GetRequiredService<IMapperCollection>();

        protected UserBuilder UserBuilderInstance = new UserBuilder();
        protected UserGroupBuilder UserGroupBuilderInstance = new UserGroupBuilder();

        protected static bool FirstTestInSession = true;

        protected bool FirstTestInFixture = true;
        protected static int TestCount = 1;
    }
}

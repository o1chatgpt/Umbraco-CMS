// Copyright (c) Umbraco.
// See LICENSE for more details.

using System;
using Microsoft.Extensions.Logging;
using NUnit.Framework;
using Umbraco.Core.Models;
using Umbraco.Core.Persistence.Repositories;
using Umbraco.Core.Persistence.Repositories.Implement;
using Umbraco.Core.Scoping;
using Umbraco.Tests.Integration.Testing;
using Umbraco.Tests.Testing;

namespace Umbraco.Tests.Integration.Umbraco.Infrastructure.Persistence.Repositories
{
    [TestFixture]
    [UmbracoTest(Database = UmbracoTestOptions.Database.NewSchemaPerTest)]
    public class KeyValueRepositoryTests : UmbracoIntegrationTest
    {
        [Test]
        public void CanSetAndGet()
        {
            IScopeProvider provider = ScopeProvider;

            // Insert new key/value
            using (IScope scope = provider.CreateScope())
            {
                var keyValue = new KeyValue
                {
                    Identifier = "foo",
                    Value = "bar",
                    UpdateDate = DateTime.Now,
                };
                IKeyValueRepository repo = CreateRepository(provider);
                repo.Save(keyValue);
                scope.Complete();
            }

            // Retrieve key/value
            using (IScope scope = provider.CreateScope())
            {
                IKeyValueRepository repo = CreateRepository(provider);
                IKeyValue keyValue = repo.Get("foo");
                scope.Complete();

                Assert.AreEqual("bar", keyValue.Value);
            }

            // Update value
            using (IScope scope = provider.CreateScope())
            {
                IKeyValueRepository repo = CreateRepository(provider);
                IKeyValue keyValue = repo.Get("foo");
                keyValue.Value = "buzz";
                keyValue.UpdateDate = DateTime.Now;
                repo.Save(keyValue);
                scope.Complete();
            }

            // Retrieve key/value again
            using (IScope scope = provider.CreateScope())
            {
                IKeyValueRepository repo = CreateRepository(provider);
                IKeyValue keyValue = repo.Get("foo");
                scope.Complete();

                Assert.AreEqual("buzz", keyValue.Value);
            }
        }

        private IKeyValueRepository CreateRepository(IScopeProvider provider) => new KeyValueRepository((IScopeAccessor)provider, LoggerFactory.CreateLogger<KeyValueRepository>());
    }
}

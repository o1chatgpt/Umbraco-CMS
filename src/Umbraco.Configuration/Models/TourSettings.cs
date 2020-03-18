﻿using Microsoft.Extensions.Configuration;
using Umbraco.Core.Configuration.UmbracoSettings;

namespace Umbraco.Configuration.Models
{
    internal class TourSettings : ITourSettings
    {
        private readonly IConfiguration _configuration;

        public TourSettings(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public string Type { get; set; }

        public bool EnableTours => _configuration.GetValue("Umbraco:CMS:Tours:EnableTours", true);
    }
}

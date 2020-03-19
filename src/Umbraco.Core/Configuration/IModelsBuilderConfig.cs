﻿namespace Umbraco.Core.Configuration
{
    public interface IModelsBuilderConfig
    {
        bool Enable { get; }
        bool AcceptUnsafeModelsDirectory { get; }
        int DebugLevel { get; }
        bool EnableFactory { get; }
        bool FlagOutOfDateModels { get; }
        string ModelsDirectory { get; }
        ModelsMode ModelsMode { get; }
        string ModelsNamespace { get; }
    }
}

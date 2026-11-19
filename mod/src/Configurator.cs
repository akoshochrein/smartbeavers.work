using Bindito.Core;

namespace Smartbeavers.Companion;

/// <summary>Registers the mod's parts with the game. Only in a loaded game: there is nothing to report from the menu or the map editor.</summary>
[Context("Game")]
public class Configurator : IConfigurator
{
    public void Configure(IContainerDefinition containerDefinition)
    {
        containerDefinition.Bind<Pairing>().AsSingleton();
        containerDefinition.Bind<GameReader>().AsSingleton();
        containerDefinition.Bind<Reporter>().AsSingleton();
        containerDefinition.Bind<PairingBox>().AsSingleton();
    }
}

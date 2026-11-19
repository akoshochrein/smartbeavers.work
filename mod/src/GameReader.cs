using System;
using System.Collections.Generic;
using Timberborn.GameCycleSystem;
using Timberborn.GameFactionSystem;
using Timberborn.Goods;
using Timberborn.HazardousWeatherSystem;
using Timberborn.Population;
using Timberborn.ResourceCountingSystem;
using Timberborn.WeatherSystem;

namespace Smartbeavers.Companion;

/// <summary>
/// Reads the values the mod reports straight from the game: whole-settlement totals, nothing per
/// district. Must be called on the game's main thread.
///
/// Readings are named as the site's contract names them (src/shared/mod.ts in the site's code).
/// Goods are "goods.&lt;the game's id for the good&gt;"; the site knows those ids.
/// </summary>
public class GameReader(
    PopulationService populationService,
    GameCycleService gameCycleService,
    WeatherService weatherService,
    HazardousWeatherService hazardousWeatherService,
    FactionService factionService,
    IGoodService goodService,
    ResourceCountingService resourceCountingService)
{
    public const string GoodPrefix = "goods.";
    public const string WeatherName = "weather";

    /// <summary>
    /// Every reading and its current value. Weather is a number here: see <see cref="WeatherWord"/>.
    /// Goods are left out unless asked for: there are dozens and they are reported less often.
    /// </summary>
    public Dictionary<string, int> Read(bool withGoods)
    {
        var population = populationService.GlobalPopulationData;
        var readings = new Dictionary<string, int>
        {
            ["adults"] = population.NumberOfAdults,
            ["kits"] = population.NumberOfChildren,
            ["bots"] = population.NumberOfBots,
            ["free_beds"] = population.BedData.FreeBeds,
            ["cycle"] = gameCycleService.Cycle,
            ["day"] = gameCycleService.CycleDay,
            [WeatherName] = Weather(),
        };

        if (!withGoods)
        {
            return readings;
        }

        foreach (var goodId in goodService.Goods)
        {
            var count = resourceCountingService.GetGlobalResourceCount(goodId);
            // A good nobody can store has no fill to speak of.
            if (count.TotalCapacity > 0)
            {
                readings[GoodPrefix + goodId] = Math.Clamp((int)Math.Round(count.FillRate * 100f), 0, 100);
            }
        }

        return readings;
    }

    /// <summary>The save's faction as the site names it, or null for one the site doesn't know.</summary>
    public string? Faction() => factionService.Current?.Id switch
    {
        "Folktails" => "folktails",
        "IronTeeth" => "iron_teeth",
        _ => null,
    };

    public static string WeatherWord(int weather) => weather switch
    {
        1 => "drought",
        2 => "badtide",
        _ => "temperate",
    };

    int Weather()
    {
        if (!weatherService.IsHazardousWeather)
        {
            return 0;
        }

        return hazardousWeatherService.CurrentCycleHazardousWeather is BadtideWeather ? 2 : 1;
    }
}

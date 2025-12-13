import polars as pl
import nflreadpy as nfl
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class NFLDataExporter:
    # Team relocation mapping: maps historical locations to current canonical names
    TEAM_RELOCATIONS = {
        # Rams: St. Louis -> Los Angeles
        "STL": "LA",
        "St. Louis Rams": "Los Angeles Rams",

        # Chargers: San Diego -> Los Angeles
        "SD": "LAC",
        "San Diego Chargers": "Los Angeles Chargers",

        # Raiders: Oakland -> Las Vegas
        "OAK": "LV",
        "Oakland Raiders": "Las Vegas Raiders",
    }

    def __init__(self, start_year=2020, end_year=2025, output_dir="output"):
        self.start_year = start_year
        self.end_year = end_year
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        self.seasons = list(range(start_year, end_year + 1))

    def _normalize_team_name(self, df: pl.DataFrame, team_col: str) -> pl.DataFrame:
        """
        Normalize historical team names to their current canonical names.
        This ensures relocated teams (Rams, Chargers, Raiders) have consistent teamIDs.
        """
        # Create a mapping expression that replaces old team names with current ones
        normalized_col = pl.col(team_col)
        for old_name, new_name in self.TEAM_RELOCATIONS.items():
            normalized_col = pl.when(pl.col(team_col) == old_name).then(pl.lit(new_name)).otherwise(normalized_col)

        return df.with_columns([normalized_col.alias(team_col)])

    def fetch_all_data(self):
        logger.info(f"Fetching data for seasons {self.start_year}-{self.end_year}")
        
        try:
            logger.info("Fetching weekly player stats...")
            self.player_stats = nfl.load_player_stats(seasons=self.seasons, summary_level="week")
            
            logger.info("Fetching rosters...")
            self.rosters = nfl.load_rosters(seasons=self.seasons)
            
            logger.info("Fetching weekly rosters...")
            self.weekly_rosters = nfl.load_rosters_weekly(seasons=self.seasons)
            
            logger.info("Fetching injury data...")
            self.injuries = self._fetch_with_fallback(nfl.load_injuries, "injuries", min_year=2009)
            
            logger.info("Fetching contract data...")
            try:
                self.contracts = nfl.load_contracts()
            except Exception as e:
                logger.warning(f"Could not fetch contracts: {e}")
                self.contracts = pl.DataFrame()
            
            logger.info("Fetching snap counts...")
            self.snap_counts = self._fetch_with_fallback(nfl.load_snap_counts, "snap_counts", min_year=2012)
            
            logger.info("Fetching team stats...")
            self.team_stats = nfl.load_team_stats(seasons=self.seasons, summary_level="week")
            
            logger.info("Fetching schedules...")
            self.schedules = nfl.load_schedules(seasons=self.seasons)
            
            logger.info("Fetching team information...")
            self.teams = nfl.load_teams()

            logger.info("Fetching players (ID crosswalk)...")
            try:
                self.players = nfl.load_players()
            except Exception as e:
                logger.warning(f"Could not fetch players crosswalk: {e}")
                self.players = pl.DataFrame()

            logger.info("Fetching weekly trade information...")
            self.trades = nfl.load_trades()
            
            logger.info("All data fetched successfully!")
            return True
            
        except Exception as e:
            logger.error(f"Error fetching data: {e}")
            raise
    
    def _fetch_with_fallback(self, fetch_func, data_name, min_year=None):
        try:
            return fetch_func(seasons=self.seasons)
        except Exception as e:
            logger.warning(f"Could not fetch all {data_name} at once: {e}")
            logger.info(f"Fetching {data_name} year by year...")
            
            dataframes = []
            for season in self.seasons:
                if min_year and season < min_year:
                    logger.info(f"Skipping {season} (data not available before {min_year})")
                    continue
                
                try:
                    df = fetch_func(seasons=season)
                    dataframes.append(df)
                    logger.info(f"✓ Fetched {data_name} for {season}")
                except Exception as year_error:
                    logger.warning(f"✗ Could not fetch {data_name} for {season}: {year_error}")
                    continue
            
            if dataframes:
                logger.info(f"Successfully fetched {data_name} for {len(dataframes)} season(s)")
                return pl.concat(dataframes, how="diagonal_relaxed")
            else:
                logger.warning(f"No {data_name} data available for any season")
                return pl.DataFrame()

    def _standardize_keys(self, df: pl.DataFrame, id_col: str = "playerID") -> pl.DataFrame:
        cols = df.columns
        exprs = []
        if id_col in cols:
            exprs.append(pl.col(id_col).cast(pl.Utf8))
        if "week" in cols:
            exprs.append(pl.col("week").cast(pl.Int32))
        if "year" in cols:
            exprs.append(pl.col("year").cast(pl.Int32))
        if not exprs:
            return df
        return df.with_columns(exprs)

    def _map_snap_counts_to_gsis(self) -> pl.DataFrame:
        if len(self.snap_counts) == 0:
            return pl.DataFrame()

        sc = self.snap_counts
        base_cols = [
            pl.col("week"),
            pl.col("season").alias("year"),
            pl.col("offense_snaps"),
            pl.col("offense_pct"),
            pl.col("defense_snaps"),
            pl.col("defense_pct"),
        ]

        if "gsis_id" in sc.columns:
            out = sc.select([pl.col("gsis_id").alias("playerID"), *base_cols])
            return self._standardize_keys(out)

        # Snap counts use 'pfr_player_id' column, not 'pfr_id'
        if "pfr_player_id" in sc.columns and len(self.players) > 0 and "pfr_id" in self.players.columns and "gsis_id" in self.players.columns:
            pmap = self.players.select([pl.col("pfr_id"), pl.col("gsis_id")]).filter(pl.col("gsis_id").is_not_null())
            out = sc.join(pmap, left_on="pfr_player_id", right_on="pfr_id", how="left").select([pl.col("gsis_id").alias("playerID"), *base_cols])
            return self._standardize_keys(out)

        if "player" in sc.columns and len(self.players) > 0 and "full_name" in self.players.columns and "gsis_id" in self.players.columns:
            pmap = self.players.select([pl.col("full_name"), pl.col("gsis_id")]).filter(pl.col("gsis_id").is_not_null())
            out = sc.join(pmap, left_on="player", right_on="full_name", how="left").select([pl.col("gsis_id").alias("playerID"), *base_cols])
            return self._standardize_keys(out)

        logger.warning("Could not map snap counts to GSIS IDs; playTime will be null")
        return pl.DataFrame()

    def _contracts_by_year_df(self) -> pl.DataFrame:
        if len(self.contracts) == 0:
            return pl.DataFrame()

        contracts = self.contracts.select([
            pl.col("otc_id").cast(pl.Utf8).alias("otc_id"),
            pl.col("year_signed"),
            pl.col("years"),
            pl.col("apy"),
        ]).filter(pl.col("otc_id").is_not_null() & pl.col("year_signed").is_not_null())

        contracts = contracts.with_columns([
            pl.when(pl.col("years").is_null()).then(1).otherwise(pl.col("years")).cast(pl.Int32).alias("years")
        ])

        contracts = contracts.with_columns([
            pl.int_ranges(pl.col("year_signed"), pl.col("year_signed") + pl.col("years")).alias("year_list"),
            pl.date(pl.col("year_signed"), 3, 1).alias("contractCreateDate"),
            pl.date(pl.col("year_signed") + pl.col("years"), 3, 1).alias("contractExpireDate"),
        ])

        contracts_by_year = contracts.explode("year_list").rename({"year_list": "year"})\
            .select([
                pl.col("otc_id"),
                pl.col("year").cast(pl.Int32),
                pl.col("apy").alias("contractSalary"),
                pl.col("contractCreateDate"),
                pl.col("contractExpireDate"),
                pl.col("year_signed"),
                pl.col("years"),
            ])

        return contracts_by_year
    
    def create_weekly_player_data(self):
        logger.info("Creating WeeklyPlayerData...")

        df = self.player_stats.select([
            pl.col("player_id").alias("playerID"),
            pl.col("week"),
            pl.col("season").alias("year"),
            pl.col("team").alias("team"),
            pl.col("position"),
            pl.col("fantasy_points").alias("ppg"),
            pl.col("fantasy_points_ppr").alias("ppg_ppr"),
            (pl.col("passing_yards").fill_null(0) +
             pl.col("rushing_yards").fill_null(0) +
             pl.col("receiving_yards").fill_null(0)).alias("yards"),
            # Passing stats
            pl.col("completions"),
            pl.col("attempts"),
            pl.col("passing_yards"),
            pl.col("passing_tds"),
            pl.col("passing_interceptions"),
            pl.col("sacks_suffered"),
            pl.col("sack_yards_lost"),
            # Rushing stats
            pl.col("carries"),
            pl.col("rushing_yards"),
            pl.col("rushing_tds"),
            pl.col("rushing_fumbles"),
            pl.col("rushing_fumbles_lost"),
            # Receiving stats
            pl.col("receptions"),
            pl.col("targets"),
            pl.col("receiving_yards"),
            pl.col("receiving_tds"),
            pl.col("receiving_fumbles"),
            pl.col("receiving_fumbles_lost"),
            # Defensive stats
            pl.col("def_tackles_solo"),
            pl.col("def_tackles_with_assist"),
            pl.col("def_tackle_assists"),
            pl.col("def_tackles_for_loss"),
            pl.col("def_sacks"),
            pl.col("def_sack_yards"),
            pl.col("def_qb_hits"),
            pl.col("def_interceptions"),
            pl.col("def_interception_yards"),
            pl.col("def_pass_defended"),
            pl.col("def_fumbles_forced"),
            pl.col("def_fumbles"),
            pl.col("def_tds"),
            # Kicking stats
            pl.col("fg_made"),
            pl.col("fg_att"),
            pl.col("fg_pct"),
            pl.col("pat_made"),
            pl.col("pat_att"),
            # Return stats
            pl.col("kickoff_returns"),
            pl.col("kickoff_return_yards"),
            pl.col("punt_returns"),
            pl.col("punt_return_yards"),
        ])
        df = self._standardize_keys(df)
        
        # Normalize team names for relocated teams before hashing
        df = self._normalize_team_name(df, "team")
        df = df.with_columns([pl.col("team").hash().abs().alias("teamID")])

        # 3NF: Remove injuryStatus and playTime - they belong in separate normalized tables
        final_df = df.select([
            "playerID", "week", "year", "teamID", "position", "ppg", "ppg_ppr", "yards",
            # Passing
            "completions", "attempts", "passing_yards", "passing_tds", "passing_interceptions",
            "sacks_suffered", "sack_yards_lost",
            # Rushing
            "carries", "rushing_yards", "rushing_tds", "rushing_fumbles", "rushing_fumbles_lost",
            # Receiving
            "receptions", "targets", "receiving_yards", "receiving_tds", "receiving_fumbles", "receiving_fumbles_lost",
            # Defense
            "def_tackles_solo", "def_tackles_with_assist", "def_tackle_assists", "def_tackles_for_loss",
            "def_sacks", "def_sack_yards", "def_qb_hits", "def_interceptions", "def_interception_yards",
            "def_pass_defended", "def_fumbles_forced", "def_fumbles", "def_tds",
            # Kicking
            "fg_made", "fg_att", "fg_pct", "pat_made", "pat_att",
            # Returns
            "kickoff_returns", "kickoff_return_yards", "punt_returns", "punt_return_yards",
        ])

        output_path = self.output_dir / "WeeklyPlayerData.csv"
        final_df.write_csv(output_path)
        logger.info(f"WeeklyPlayerData saved to {output_path} ({len(final_df)} rows)")

        return final_df
    
    def create_historic_player_data(self):
        logger.info("Creating HistoricPlayerData...")

        df = self.player_stats.select([
            pl.col("player_id").alias("playerID"),
            pl.col("season").alias("year"),
            pl.col("team").alias("team"),
            pl.col("position"),
            pl.col("fantasy_points").alias("ppg"),
            pl.col("fantasy_points_ppr").alias("ppg_ppr"),
            (pl.col("passing_yards").fill_null(0) +
             pl.col("rushing_yards").fill_null(0) +
             pl.col("receiving_yards").fill_null(0)).alias("yards"),
            # Passing stats
            pl.col("completions"),
            pl.col("attempts"),
            pl.col("passing_yards"),
            pl.col("passing_tds"),
            pl.col("passing_interceptions"),
            pl.col("sacks_suffered"),
            pl.col("sack_yards_lost"),
            # Rushing stats
            pl.col("carries"),
            pl.col("rushing_yards"),
            pl.col("rushing_tds"),
            pl.col("rushing_fumbles"),
            pl.col("rushing_fumbles_lost"),
            # Receiving stats
            pl.col("receptions"),
            pl.col("targets"),
            pl.col("receiving_yards"),
            pl.col("receiving_tds"),
            pl.col("receiving_fumbles"),
            pl.col("receiving_fumbles_lost"),
            # Defensive stats
            pl.col("def_tackles_solo"),
            pl.col("def_tackles_with_assist"),
            pl.col("def_tackle_assists"),
            pl.col("def_tackles_for_loss"),
            pl.col("def_sacks"),
            pl.col("def_sack_yards"),
            pl.col("def_qb_hits"),
            pl.col("def_interceptions"),
            pl.col("def_interception_yards"),
            pl.col("def_pass_defended"),
            pl.col("def_fumbles_forced"),
            pl.col("def_fumbles"),
            pl.col("def_tds"),
            # Kicking stats
            pl.col("fg_made"),
            pl.col("fg_att"),
            pl.col("fg_pct"),
            pl.col("pat_made"),
            pl.col("pat_att"),
            # Return stats
            pl.col("kickoff_returns"),
            pl.col("kickoff_return_yards"),
            pl.col("punt_returns"),
            pl.col("punt_return_yards"),
        ])
        df = self._standardize_keys(df)

        df = df.group_by(["playerID", "year", "team", "position"]).agg([
            pl.col("ppg").mean().alias("ppg"),
            pl.col("ppg_ppr").mean().alias("ppg_ppr"),
            pl.col("yards").sum().alias("yards"),
            # Passing aggregates
            pl.col("completions").sum().alias("completions"),
            pl.col("attempts").sum().alias("attempts"),
            pl.col("passing_yards").sum().alias("passing_yards"),
            pl.col("passing_tds").sum().alias("passing_tds"),
            pl.col("passing_interceptions").sum().alias("passing_interceptions"),
            pl.col("sacks_suffered").sum().alias("sacks_suffered"),
            pl.col("sack_yards_lost").sum().alias("sack_yards_lost"),
            # Rushing aggregates
            pl.col("carries").sum().alias("carries"),
            pl.col("rushing_yards").sum().alias("rushing_yards"),
            pl.col("rushing_tds").sum().alias("rushing_tds"),
            pl.col("rushing_fumbles").sum().alias("rushing_fumbles"),
            pl.col("rushing_fumbles_lost").sum().alias("rushing_fumbles_lost"),
            # Receiving aggregates
            pl.col("receptions").sum().alias("receptions"),
            pl.col("targets").sum().alias("targets"),
            pl.col("receiving_yards").sum().alias("receiving_yards"),
            pl.col("receiving_tds").sum().alias("receiving_tds"),
            pl.col("receiving_fumbles").sum().alias("receiving_fumbles"),
            pl.col("receiving_fumbles_lost").sum().alias("receiving_fumbles_lost"),
            # Defensive aggregates
            pl.col("def_tackles_solo").sum().alias("def_tackles_solo"),
            pl.col("def_tackles_with_assist").sum().alias("def_tackles_with_assist"),
            pl.col("def_tackle_assists").sum().alias("def_tackle_assists"),
            pl.col("def_tackles_for_loss").sum().alias("def_tackles_for_loss"),
            pl.col("def_sacks").sum().alias("def_sacks"),
            pl.col("def_sack_yards").sum().alias("def_sack_yards"),
            pl.col("def_qb_hits").sum().alias("def_qb_hits"),
            pl.col("def_interceptions").sum().alias("def_interceptions"),
            pl.col("def_interception_yards").sum().alias("def_interception_yards"),
            pl.col("def_pass_defended").sum().alias("def_pass_defended"),
            pl.col("def_fumbles_forced").sum().alias("def_fumbles_forced"),
            pl.col("def_fumbles").sum().alias("def_fumbles"),
            pl.col("def_tds").sum().alias("def_tds"),
            # Kicking aggregates
            pl.col("fg_made").sum().alias("fg_made"),
            pl.col("fg_att").sum().alias("fg_att"),
            pl.col("fg_pct").mean().alias("fg_pct"),
            pl.col("pat_made").sum().alias("pat_made"),
            pl.col("pat_att").sum().alias("pat_att"),
            # Return aggregates
            pl.col("kickoff_returns").sum().alias("kickoff_returns"),
            pl.col("kickoff_return_yards").sum().alias("kickoff_return_yards"),
            pl.col("punt_returns").sum().alias("punt_returns"),
            pl.col("punt_return_yards").sum().alias("punt_return_yards"),
        ])

        # Normalize team names for relocated teams before hashing
        df = self._normalize_team_name(df, "team")
        df = df.with_columns([pl.col("team").hash().abs().alias("teamID")])

        # 3NF: Remove injuryStatus and playTime - they belong in separate normalized tables
        final_df = df.select([
            "playerID", "year", "teamID", "position", "ppg", "ppg_ppr", "yards",
            # Passing
            "completions", "attempts", "passing_yards", "passing_tds", "passing_interceptions",
            "sacks_suffered", "sack_yards_lost",
            # Rushing
            "carries", "rushing_yards", "rushing_tds", "rushing_fumbles", "rushing_fumbles_lost",
            # Receiving
            "receptions", "targets", "receiving_yards", "receiving_tds", "receiving_fumbles", "receiving_fumbles_lost",
            # Defense
            "def_tackles_solo", "def_tackles_with_assist", "def_tackle_assists", "def_tackles_for_loss",
            "def_sacks", "def_sack_yards", "def_qb_hits", "def_interceptions", "def_interception_yards",
            "def_pass_defended", "def_fumbles_forced", "def_fumbles", "def_tds",
            # Kicking
            "fg_made", "fg_att", "fg_pct", "pat_made", "pat_att",
            # Returns
            "kickoff_returns", "kickoff_return_yards", "punt_returns", "punt_return_yards",
        ])

        output_path = self.output_dir / "HistoricPlayerData.csv"
        final_df.write_csv(output_path)
        logger.info(f"HistoricPlayerData saved to {output_path} ({len(final_df)} rows)")

        return final_df
    
    def create_weekly_team_data(self):
        logger.info("Creating WeeklyTeamData...")
        
        df = self.schedules.select([
            pl.col("season").alias("year"),
            pl.col("week"),
            pl.col("home_team").alias("team"),
            pl.col("home_score").alias("pointsFor"),
            pl.col("away_score").alias("pointsAgainst"),
            (pl.col("home_score") - pl.col("away_score")).alias("home_result")
        ])
        
        df_away = self.schedules.select([
            pl.col("season").alias("year"),
            pl.col("week"),
            pl.col("away_team").alias("team"),
            pl.col("away_score").alias("pointsFor"),
            pl.col("home_score").alias("pointsAgainst"),
            (pl.col("away_score") - pl.col("home_score")).alias("home_result")
        ])
        
        df = pl.concat([df, df_away])
        df = df.sort(["team", "year", "week"])
        
        df = df.with_columns([
            pl.when(pl.col("home_result") > 0).then(1).otherwise(0).alias("is_win"),
            pl.when(pl.col("home_result") < 0).then(1).otherwise(0).alias("is_loss"),
            pl.when(pl.col("home_result") == 0).then(1).otherwise(0).alias("is_tie")
        ])
        
        df = df.with_columns([
            pl.col("is_win").cum_sum().over(["team", "year"]).alias("wins"),
            pl.col("is_loss").cum_sum().over(["team", "year"]).alias("losses"),
            pl.col("is_tie").cum_sum().over(["team", "year"]).alias("ties")
        ])

        # Normalize team names for relocated teams before hashing
        df = self._normalize_team_name(df, "team")
        df = df.with_columns([pl.col("team").hash().abs().alias("teamID")])
        
        final_df = df.select([
            "teamID", "week", "year", "wins", "losses", "ties", "pointsFor", "pointsAgainst"
        ])
        
        final_df = final_df.filter(pl.col("week").is_not_null())
        
        output_path = self.output_dir / "WeeklyTeamData.csv"
        final_df.write_csv(output_path)
        logger.info(f"WeeklyTeamData saved to {output_path} ({len(final_df)} rows)")
        
        return final_df
    
    def create_team_mapping(self):
        logger.info("Creating team mapping reference...")

        base = self.teams.select([
            pl.col("team_abbr"),
            pl.col("team_name"),
            pl.col("team_conf"),
            pl.col("team_division"),
        ])

        # Normalize team abbreviations for relocated teams
        base = self._normalize_team_name(base, "team_abbr")
        base = self._normalize_team_name(base, "team_name")

        # Derive nickname ("name") as the last word and "city" as everything before it
        enriched = base.with_columns([
            pl.col("team_name").str.extract(r"^(.+?)\s+([^\s]+)$", group_index=2).alias("name"),
            pl.col("team_name").str.extract(r"^(.+?)\s+([^\s]+)$", group_index=1).alias("city"),
        ])

        # Remove duplicate entries by keeping only unique team_abbr values
        enriched = enriched.unique(subset=["team_abbr"])

        teams_final = enriched.select([
            pl.col("team_abbr").hash().abs().alias("teamID"),
            pl.col("name"),
            pl.col("city"),
            pl.col("team_conf").alias("conference"),
            pl.col("team_division").alias("division"),
        ])
        
        output_path = self.output_dir / "TeamMapping.csv"
        teams_final.write_csv(output_path)
        logger.info(f"Team mapping saved to {output_path}")
        
        return teams_final
    
    def create_player_mapping(self):
        logger.info("Creating player mapping reference...")
        
        # Filter by last_season >= start_year or null, then select columns
        players_df = self.players.filter(
            (pl.col("last_season") >= self.start_year) | (pl.col("last_season").is_null())
        ).select([
            pl.col("gsis_id").alias("playerID"),
            pl.col("pfr_id").alias("playerID_trade"),
            pl.col("display_name").alias("full_name"),
            pl.col("first_name"),
            pl.col("last_name"),
            pl.col("birth_date"),
        ]).unique(subset=["playerID"])
        
        output_path = self.output_dir / "PlayerMapping.csv"
        players_df.write_csv(output_path)
        logger.info(f"Player mapping saved to {output_path}")
        
        return players_df

    def create_player_contracts(self):
        """Create PlayerContracts.csv - all contract data for each player-year combination"""
        logger.info("Creating PlayerContracts...")
        
        if len(self.contracts) == 0 or not hasattr(self, "players") or len(self.players) == 0:
            logger.warning("No contract data or player crosswalk available")
            return pl.DataFrame()
        
        # Get the otc_id to gsis_id mapping
        otc_map = self.players.select([
            pl.col("gsis_id").alias("playerID"),
            pl.col("otc_id")
        ]).filter(pl.col("otc_id").is_not_null())
        
        # Get all contracts by year (this includes all contracts, not deduplicated)
        contracts_by_year = self._contracts_by_year_df()
        if len(contracts_by_year) == 0:
            logger.warning("No contract data available after processing")
            return pl.DataFrame()
        
        # Join with player mapping to get playerID (gsis_id)
        contracts_df = contracts_by_year.join(otc_map, on="otc_id", how="inner")
        
        # Select final columns
        final_df = contracts_df.select([
            "playerID",
            "year",
            pl.col("contractSalary"),
            pl.col("contractCreateDate"),
            pl.col("contractExpireDate"),
            pl.col("year_signed"),
            pl.col("years").alias("contract_years"),
        ])
        
        output_path = self.output_dir / "PlayerContracts.csv"
        final_df.write_csv(output_path)
        logger.info(f"PlayerContracts saved to {output_path} ({len(final_df)} rows)")
        
        return final_df

    def create_injury_data(self):
        """Create InjuryData.csv - 3NF normalized injury status table"""
        logger.info("Creating InjuryData...")
        
        if len(self.injuries) == 0:
            logger.warning("No injury data available")
            return pl.DataFrame()
        
        injury_df = self.injuries.select([
            pl.col("gsis_id").alias("playerID"),
            pl.col("week"),
            pl.col("season").alias("year"),
            pl.col("report_status").alias("injuryStatus"),
            pl.col("report_primary_injury").alias("primaryInjury"),
            pl.col("practice_status").alias("practiceStatus"),
        ])
        injury_df = self._standardize_keys(injury_df)
        
        # Filter out rows without valid keys
        injury_df = injury_df.filter(
            pl.col("playerID").is_not_null() & 
            (pl.col("playerID") != "") &
            pl.col("week").is_not_null() &
            pl.col("year").is_not_null()
        )
        
        # Deduplicate by primary key
        injury_df = injury_df.unique(subset=["playerID", "week", "year"], keep="first")
        
        output_path = self.output_dir / "InjuryData.csv"
        injury_df.write_csv(output_path)
        logger.info(f"InjuryData saved to {output_path} ({len(injury_df)} rows)")
        
        return injury_df

    def create_snap_counts(self):
        """Create SnapCounts.csv - 3NF normalized snap count table"""
        logger.info("Creating SnapCounts...")
        
        mapped_snaps = self._map_snap_counts_to_gsis()
        if len(mapped_snaps) == 0:
            logger.warning("No snap count data available")
            return pl.DataFrame()
        
        snap_df = mapped_snaps.select([
            "playerID",
            "week",
            "year",
            pl.col("offense_snaps").alias("offenseSnaps"),
            pl.col("offense_pct").alias("offensePct"),
            pl.col("defense_snaps").alias("defenseSnaps"),
            pl.col("defense_pct").alias("defensePct"),
        ])
        
        # Filter out rows without valid keys
        snap_df = snap_df.filter(
            pl.col("playerID").is_not_null() & 
            (pl.col("playerID") != "") &
            pl.col("week").is_not_null() &
            pl.col("year").is_not_null()
        )
        
        # Deduplicate by primary key
        snap_df = snap_df.unique(subset=["playerID", "week", "year"], keep="first")
        
        output_path = self.output_dir / "SnapCounts.csv"
        snap_df.write_csv(output_path)
        logger.info(f"SnapCounts saved to {output_path} ({len(snap_df)} rows)")
        
        return snap_df

    def create_trade_data(self):
        """Create TradeTable.csv - 3NF normalized (player_name removed, use PlayerMapping)"""
        logger.info("Creating trade data table...")

        trades_df = self.trades.select([
            pl.col("trade_id"),
            pl.col("season"),
            pl.col("trade_date").alias("date"),
            pl.col("gave"),
            pl.col("received"),
            pl.col("pfr_id").alias("playerID"),
            # 3NF: player_name removed - can be joined from PlayerMapping
        ])

        # Normalize team names for relocated teams before hashing
        trades_df = self._normalize_team_name(trades_df, "gave")
        trades_df = self._normalize_team_name(trades_df, "received")

        # Now hash the normalized team names
        trades_df = trades_df.with_columns([
            pl.col("gave").hash().abs().alias("team_gave"),
            pl.col("received").hash().abs().alias("team_received"),
        ]).select([
            "trade_id", "season", "date", "team_gave", "team_received", "playerID"
        ])

        output_path = self.output_dir / "TradeTable.csv"
        trades_df.write_csv(output_path)
        logger.info(f"Trade data saved to {output_path}")

        return trades_df
    
    def export_all(self):
        try:
            self.fetch_all_data()
            
            # Core player/team data
            self.create_weekly_player_data()
            self.create_historic_player_data()
            self.create_weekly_team_data()
            
            # Reference/mapping tables
            self.create_team_mapping()
            self.create_player_mapping()
            
            # 3NF normalized tables
            self.create_player_contracts()
            self.create_injury_data()
            self.create_snap_counts()
            self.create_trade_data()
            
            logger.info(f"✓ All data exported successfully to {self.output_dir}/")
            logger.info("\nGenerated files:")
            logger.info("  Core tables:")
            logger.info("    - WeeklyPlayerData.csv (PK: playerID, week, year)")
            logger.info("    - HistoricPlayerData.csv (PK: playerID, year)")
            logger.info("    - WeeklyTeamData.csv (PK: teamID, week, year)")
            logger.info("  Reference tables:")
            logger.info("    - TeamMapping.csv (PK: teamID)")
            logger.info("    - PlayerMapping.csv (PK: playerID)")
            logger.info("  3NF normalized tables:")
            logger.info("    - PlayerContracts.csv (PK: playerID, year, year_signed)")
            logger.info("    - InjuryData.csv (PK: playerID, week, year)")
            logger.info("    - SnapCounts.csv (PK: playerID, week, year)")
            logger.info("    - TradeTable.csv (PK: trade_id)")
            
        except Exception as e:
            logger.error(f"Export failed: {e}")
            raise


def main():
    print("=" * 60)
    print("NFL Data Export Tool")
    print("=" * 60)
    print()

    exporter = NFLDataExporter(start_year=2015, end_year=2025, output_dir="output")
    
    print(f"Exporting data for seasons {exporter.start_year}-{exporter.end_year}")
    print("This may take several minutes...\n")
    
    exporter.export_all()
    
    print()
    print("=" * 60)
    print("Export Complete!")
    print("=" * 60)
    print(f"Output location: {exporter.output_dir.absolute()}")


if __name__ == "__main__":
    main()

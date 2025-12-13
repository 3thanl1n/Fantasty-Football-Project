import polars as pl
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class CSVCleaner:
    def __init__(self, data_dir="output"):
        self.data_dir = Path(data_dir)
    
    def _read_csv(self, file_path: Path, schema_overrides: dict | None = None) -> pl.DataFrame:
        """
        Read CSV with safe defaults:
        - Handle very large numeric IDs (e.g., teamID > i64) via schema_overrides
        - Treat empty strings as nulls
        - Tolerate ragged lines with trailing commas
        """
        return pl.read_csv(
            file_path,
            infer_schema_length=10000,
            null_values=["", "NA", "NaN", "null", "NULL"],
            schema_overrides=schema_overrides or {},
            truncate_ragged_lines=True,
        )
        
    def clean_player_mapping(self):
        """Clean PlayerMapping.csv - remove rows without playerID"""
        file_path = self.data_dir / "PlayerMapping.csv"
        if not file_path.exists():
            logger.warning(f"{file_path} not found, skipping")
            return
        
        df = self._read_csv(file_path, schema_overrides={
            "playerID": pl.Utf8,
            "playerID_trade": pl.Utf8,
            "full_name": pl.Utf8,
            "first_name": pl.Utf8,
            "last_name": pl.Utf8,
        })
        original_count = len(df)
        
        df_clean = df.filter(pl.col("playerID").is_not_null() & (pl.col("playerID") != ""))
        
        # Deduplicate by primary key (playerID)
        df_clean = df_clean.unique(subset=["playerID"], keep="first")
        cleaned_count = len(df_clean)
        
        if original_count != cleaned_count:
            df_clean.write_csv(file_path)
            logger.info(f"PlayerMapping: removed {original_count - cleaned_count} rows (nulls + duplicates)")
        else:
            logger.info(f"PlayerMapping: no issues found ({original_count} rows)")
    
    def clean_team_mapping(self):
        """Clean TeamMapping.csv - remove rows without teamID"""
        file_path = self.data_dir / "TeamMapping.csv"
        if not file_path.exists():
            logger.warning(f"{file_path} not found, skipping")
            return
        
        df = self._read_csv(file_path, schema_overrides={
            "teamID": pl.UInt64,  # can exceed i64 range
            "name": pl.Utf8,
            "city": pl.Utf8,
            "conference": pl.Utf8,
            "division": pl.Utf8,
        })
        original_count = len(df)
        
        df_clean = df.filter(pl.col("teamID").is_not_null())
        
        # Deduplicate by primary key (teamID)
        df_clean = df_clean.unique(subset=["teamID"], keep="first")
        cleaned_count = len(df_clean)
        
        if original_count != cleaned_count:
            df_clean.write_csv(file_path)
            logger.info(f"TeamMapping: removed {original_count - cleaned_count} rows (nulls + duplicates)")
        else:
            logger.info(f"TeamMapping: no issues found ({original_count} rows)")
    
    def clean_weekly_player_data(self):
        """Clean WeeklyPlayerData.csv - remove rows without playerID, week, or year and deduplicate"""
        file_path = self.data_dir / "WeeklyPlayerData.csv"
        if not file_path.exists():
            logger.warning(f"{file_path} not found, skipping")
            return
        
        # 3NF: injuryStatus and playTime moved to separate tables
        df = self._read_csv(file_path, schema_overrides={
            "playerID": pl.Utf8,
            "week": pl.Int32,
            "year": pl.Int32,
            "teamID": pl.UInt64,  # can exceed i64 range
            "position": pl.Utf8,
            "ppg": pl.Float64,
            "yards": pl.Int64,
        })
        original_count = len(df)
        
        # Filter out rows with missing keys
        df_clean = df.filter(
            pl.col("playerID").is_not_null() & 
            (pl.col("playerID") != "") &
            pl.col("week").is_not_null() &
            pl.col("year").is_not_null()
        )
        
        # Deduplicate by primary key (playerID, week, year) - keep first occurrence
        df_clean = df_clean.unique(subset=["playerID", "week", "year"], keep="first")
        cleaned_count = len(df_clean)
        
        if original_count != cleaned_count:
            df_clean.write_csv(file_path)
            logger.info(f"WeeklyPlayerData: removed {original_count - cleaned_count} rows (nulls + duplicates)")
        else:
            logger.info(f"WeeklyPlayerData: no issues found ({original_count} rows)")
    
    def clean_historic_player_data(self):
        """Clean HistoricPlayerData.csv - remove rows without playerID or year and deduplicate"""
        file_path = self.data_dir / "HistoricPlayerData.csv"
        if not file_path.exists():
            logger.warning(f"{file_path} not found, skipping")
            return
        
        # 3NF: injuryStatus and playTime moved to separate tables
        df = self._read_csv(file_path, schema_overrides={
            "playerID": pl.Utf8,
            "year": pl.Int32,
            "teamID": pl.UInt64,  # can exceed i64 range
            "position": pl.Utf8,
            "ppg": pl.Float64,
            "yards": pl.Int64,
        })
        original_count = len(df)
        
        # Filter out rows with missing keys (all PK columns required)
        df_clean = df.filter(
            pl.col("playerID").is_not_null() & 
            (pl.col("playerID") != "") &
            pl.col("year").is_not_null() &
            pl.col("teamID").is_not_null()
        )
        
        # Deduplicate by primary key (playerID, year, teamID) - keep first occurrence
        # This preserves data for players who played on multiple teams in a year
        df_clean = df_clean.unique(subset=["playerID", "year", "teamID"], keep="first")
        cleaned_count = len(df_clean)
        
        if original_count != cleaned_count:
            df_clean.write_csv(file_path)
            logger.info(f"HistoricPlayerData: removed {original_count - cleaned_count} rows (nulls + duplicates)")
        else:
            logger.info(f"HistoricPlayerData: no issues found ({original_count} rows)")
    
    def clean_weekly_team_data(self):
        """Clean WeeklyTeamData.csv - remove rows without teamID, week, or year"""
        file_path = self.data_dir / "WeeklyTeamData.csv"
        if not file_path.exists():
            logger.warning(f"{file_path} not found, skipping")
            return
        
        df = self._read_csv(file_path, schema_overrides={
            "teamID": pl.UInt64,  # can exceed i64 range
            "week": pl.Int32,
            "year": pl.Int32,
            "wins": pl.Int32,
            "losses": pl.Int32,
            "ties": pl.Int32,
            "pointsFor": pl.Int32,
            "pointsAgainst": pl.Int32,
        })
        original_count = len(df)
        
        df_clean = df.filter(
            pl.col("teamID").is_not_null() &
            pl.col("week").is_not_null() &
            pl.col("year").is_not_null()
        )
        
        # Deduplicate by primary key (teamID, week, year)
        df_clean = df_clean.unique(subset=["teamID", "week", "year"], keep="first")
        cleaned_count = len(df_clean)
        
        if original_count != cleaned_count:
            df_clean.write_csv(file_path)
            logger.info(f"WeeklyTeamData: removed {original_count - cleaned_count} rows (nulls + duplicates)")
        else:
            logger.info(f"WeeklyTeamData: no issues found ({original_count} rows)")
    
    def clean_player_contracts(self):
        """Clean PlayerContracts.csv - remove rows without playerID or year"""
        file_path = self.data_dir / "PlayerContracts.csv"
        if not file_path.exists():
            logger.warning(f"{file_path} not found, skipping")
            return
        
        df = self._read_csv(file_path, schema_overrides={
            "playerID": pl.Utf8,
            "year": pl.Int32,
            "contractSalary": pl.Float64,
            "contractCreateDate": pl.Utf8,
            "contractExpireDate": pl.Utf8,
            "year_signed": pl.Int32,
            "contract_years": pl.Int32,
        })
        original_count = len(df)
        
        df_clean = df.filter(
            pl.col("playerID").is_not_null() & 
            (pl.col("playerID") != "") &
            pl.col("year").is_not_null() &
            pl.col("year_signed").is_not_null()
        )
        
        # Fix invalid dates (year 0000 is not valid in PostgreSQL)
        df_clean = df_clean.with_columns([
            pl.when(pl.col("contractCreateDate").str.starts_with("0000"))
              .then(None)
              .otherwise(pl.col("contractCreateDate"))
              .alias("contractCreateDate"),
            pl.when(pl.col("contractExpireDate").str.starts_with("0000"))
              .then(None)
              .otherwise(pl.col("contractExpireDate"))
              .alias("contractExpireDate"),
        ])
        
        # Deduplicate by primary key (playerID, year, year_signed)
        df_clean = df_clean.unique(subset=["playerID", "year", "year_signed"], keep="first")
        cleaned_count = len(df_clean)
        
        # Always write to fix invalid dates
        df_clean.write_csv(file_path)
        logger.info(f"PlayerContracts: {cleaned_count} rows (removed {original_count - cleaned_count} duplicates, fixed invalid 0000-xx-xx dates)")

    def clean_injury_data(self):
        """Clean InjuryData.csv - remove rows without playerID, week, or year"""
        file_path = self.data_dir / "InjuryData.csv"
        if not file_path.exists():
            logger.warning(f"{file_path} not found, skipping")
            return
        
        df = self._read_csv(file_path, schema_overrides={
            "playerID": pl.Utf8,
            "week": pl.Int32,
            "year": pl.Int32,
            "injuryStatus": pl.Utf8,
            "primaryInjury": pl.Utf8,
            "practiceStatus": pl.Utf8,
        })
        original_count = len(df)
        
        df_clean = df.filter(
            pl.col("playerID").is_not_null() & 
            (pl.col("playerID") != "") &
            pl.col("week").is_not_null() &
            pl.col("year").is_not_null()
        )
        
        # Deduplicate by primary key (playerID, week, year)
        df_clean = df_clean.unique(subset=["playerID", "week", "year"], keep="first")
        cleaned_count = len(df_clean)
        
        if original_count != cleaned_count:
            df_clean.write_csv(file_path)
            logger.info(f"InjuryData: removed {original_count - cleaned_count} rows (nulls + duplicates)")
        else:
            logger.info(f"InjuryData: no issues found ({original_count} rows)")

    def clean_snap_counts(self):
        """Clean SnapCounts.csv - remove rows without playerID, week, or year"""
        file_path = self.data_dir / "SnapCounts.csv"
        if not file_path.exists():
            logger.warning(f"{file_path} not found, skipping")
            return
        
        df = self._read_csv(file_path, schema_overrides={
            "playerID": pl.Utf8,
            "week": pl.Int32,
            "year": pl.Int32,
            "offenseSnaps": pl.Float64,
            "offensePct": pl.Float64,
            "defenseSnaps": pl.Float64,
            "defensePct": pl.Float64,
        })
        original_count = len(df)
        
        df_clean = df.filter(
            pl.col("playerID").is_not_null() & 
            (pl.col("playerID") != "") &
            pl.col("week").is_not_null() &
            pl.col("year").is_not_null()
        )
        
        # Deduplicate by primary key (playerID, week, year)
        df_clean = df_clean.unique(subset=["playerID", "week", "year"], keep="first")
        cleaned_count = len(df_clean)
        
        if original_count != cleaned_count:
            df_clean.write_csv(file_path)
            logger.info(f"SnapCounts: removed {original_count - cleaned_count} rows (nulls + duplicates)")
        else:
            logger.info(f"SnapCounts: no issues found ({original_count} rows)")

    def clean_trade_data(self):
        """Clean TradeTable.csv - remove rows without trade_id or playerID"""
        file_path = self.data_dir / "TradeTable.csv"
        if not file_path.exists():
            logger.warning(f"{file_path} not found, skipping")
            return
        
        # 3NF: player_name removed - join with PlayerMapping
        df = self._read_csv(file_path, schema_overrides={
            "trade_id": pl.Float64,
            "season": pl.Int32,
            "date": pl.Utf8,
            "team_gave": pl.UInt64,  # hashed team ID
            "team_received": pl.UInt64,  # hashed team ID
            "playerID": pl.Utf8,
        })
        original_count = len(df)
        
        df_clean = df.filter(
            pl.col("trade_id").is_not_null() &
            pl.col("playerID").is_not_null() & 
            (pl.col("playerID") != "")
        )
        
        # Deduplicate by primary key (trade_id, playerID)
        df_clean = df_clean.unique(subset=["trade_id", "playerID"], keep="first")
        cleaned_count = len(df_clean)
        
        if original_count != cleaned_count:
            df_clean.write_csv(file_path)
            logger.info(f"TradeTable: removed {original_count - cleaned_count} rows (nulls + duplicates)")
        else:
            logger.info(f"TradeTable: no issues found ({original_count} rows)")
    
    def clean_all(self):
        """Clean all CSV files"""
        logger.info(f"Starting CSV cleaning process for {self.data_dir}/")
        logger.info("=" * 60)
        
        self.clean_player_mapping()
        self.clean_team_mapping()
        self.clean_weekly_player_data()
        self.clean_historic_player_data()
        self.clean_weekly_team_data()
        self.clean_player_contracts()
        self.clean_injury_data()
        self.clean_snap_counts()
        self.clean_trade_data()
        
        logger.info("=" * 60)
        logger.info("✓ CSV cleaning complete!")


def main():
    print("=" * 60)
    print("NFL CSV Data Cleaner")
    print("=" * 60)
    print()
    
    cleaner = CSVCleaner(data_dir="output")
    cleaner.clean_all()
    
    print()
    print("=" * 60)
    print("Cleaning Complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()


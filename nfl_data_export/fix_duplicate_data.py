"""
Fix duplicate key issues and normalize data to 3NF

This script:
1. Extracts contract data to PlayerContracts.csv (preserves all contracts)
2. Extracts injury data to InjuryData.csv (3NF normalization)
3. Extracts snap counts to SnapCounts.csv (3NF normalization)
4. Removes extracted columns and deduplicates player data tables
5. Removes player_name from TradeTable (3NF - use PlayerMapping)
"""

import polars as pl
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def fix_historic_player_data(data_dir: Path):
    """Fix HistoricPlayerData.csv - extract contracts/injury/playtime and deduplicate"""
    file_path = data_dir / "HistoricPlayerData.csv"
    if not file_path.exists():
        logger.warning(f"{file_path} not found, skipping")
        return None
    
    logger.info("Processing HistoricPlayerData.csv...")
    df = pl.read_csv(file_path, infer_schema_length=10000, null_values=["", "NA", "NaN"])
    original_count = len(df)
    
    # Check if contract columns exist
    has_contracts = "contractSalary" in df.columns
    
    contracts_df = None
    if has_contracts:
        # Extract contract data before removing columns
        contract_cols = ["playerID", "year", "contractSalary", "contractCreateDate", "contractExpireDate"]
        available_cols = [c for c in contract_cols if c in df.columns]
        
        contracts_df = df.select(available_cols).filter(
            pl.col("contractSalary").is_not_null()
        )
        logger.info(f"  Extracted {len(contracts_df)} contract records from HistoricPlayerData")
    
    # Remove columns that belong in separate 3NF tables
    cols_to_drop = [c for c in ["contractSalary", "contractCreateDate", "contractExpireDate", "injuryStatus", "playTime"] if c in df.columns]
    if cols_to_drop:
        df = df.drop(cols_to_drop)
        logger.info(f"  Removed columns for 3NF: {cols_to_drop}")
    
    # Deduplicate by primary key (playerID, year) - keep first occurrence
    df_dedup = df.unique(subset=["playerID", "year"], keep="first")
    dedup_count = len(df_dedup)
    
    # Save fixed file
    df_dedup.write_csv(file_path)
    logger.info(f"  HistoricPlayerData: {original_count} -> {dedup_count} rows ({original_count - dedup_count} duplicates removed)")
    
    return contracts_df


def fix_weekly_player_data(data_dir: Path):
    """Fix WeeklyPlayerData.csv - extract contracts/injury/playtime and deduplicate"""
    file_path = data_dir / "WeeklyPlayerData.csv"
    if not file_path.exists():
        logger.warning(f"{file_path} not found, skipping")
        return None, None, None
    
    logger.info("Processing WeeklyPlayerData.csv...")
    df = pl.read_csv(file_path, infer_schema_length=10000, null_values=["", "NA", "NaN"])
    original_count = len(df)
    
    contracts_df = None
    injury_df = None
    snap_df = None
    
    # Extract contract data
    if "contractSalary" in df.columns:
        contract_cols = ["playerID", "year", "contractSalary", "contractCreateDate", "contractExpireDate"]
        available_cols = [c for c in contract_cols if c in df.columns]
        
        contracts_df = df.select(available_cols).filter(
            pl.col("contractSalary").is_not_null()
        ).unique()
        logger.info(f"  Extracted {len(contracts_df)} unique contract records")
    
    # Extract injury data
    if "injuryStatus" in df.columns:
        injury_cols = ["playerID", "week", "year", "injuryStatus"]
        available_cols = [c for c in injury_cols if c in df.columns]
        
        injury_df = df.select(available_cols).filter(
            pl.col("injuryStatus").is_not_null()
        ).unique(subset=["playerID", "week", "year"], keep="first")
        logger.info(f"  Extracted {len(injury_df)} injury records")
    
    # Extract snap count data (from playTime column if it exists)
    # Note: playTime is formatted as "snaps/pct%" - we'll preserve as-is for now
    if "playTime" in df.columns:
        snap_cols = ["playerID", "week", "year", "playTime"]
        available_cols = [c for c in snap_cols if c in df.columns]
        
        snap_df = df.select(available_cols).filter(
            pl.col("playTime").is_not_null()
        ).unique(subset=["playerID", "week", "year"], keep="first")
        logger.info(f"  Extracted {len(snap_df)} snap count records")
    
    # Remove columns that belong in separate 3NF tables
    cols_to_drop = [c for c in ["contractSalary", "contractCreateDate", "contractExpireDate", "injuryStatus", "playTime"] if c in df.columns]
    if cols_to_drop:
        df = df.drop(cols_to_drop)
        logger.info(f"  Removed columns for 3NF: {cols_to_drop}")
    
    # Deduplicate by primary key (playerID, week, year) - keep first occurrence
    df_dedup = df.unique(subset=["playerID", "week", "year"], keep="first")
    dedup_count = len(df_dedup)
    
    # Save fixed file
    df_dedup.write_csv(file_path)
    logger.info(f"  WeeklyPlayerData: {original_count} -> {dedup_count} rows ({original_count - dedup_count} duplicates removed)")
    
    return contracts_df, injury_df, snap_df


def fix_trade_table(data_dir: Path):
    """Fix TradeTable.csv - remove player_name (3NF: use PlayerMapping)"""
    file_path = data_dir / "TradeTable.csv"
    if not file_path.exists():
        logger.warning(f"{file_path} not found, skipping")
        return
    
    logger.info("Processing TradeTable.csv...")
    df = pl.read_csv(file_path, infer_schema_length=10000, null_values=["", "NA", "NaN"])
    original_cols = df.columns
    
    if "player_name" in df.columns:
        df = df.drop("player_name")
        df.write_csv(file_path)
        logger.info(f"  TradeTable: removed player_name column (3NF - use PlayerMapping)")
    else:
        logger.info(f"  TradeTable: already 3NF compliant")


def create_player_contracts(data_dir: Path, historic_contracts: pl.DataFrame | None, weekly_contracts: pl.DataFrame | None):
    """Combine and save all contract data to PlayerContracts.csv"""
    contracts_list = []
    
    if historic_contracts is not None and len(historic_contracts) > 0:
        contracts_list.append(historic_contracts)
    
    if weekly_contracts is not None and len(weekly_contracts) > 0:
        contracts_list.append(weekly_contracts)
    
    if not contracts_list:
        logger.info("  No contract data found to extract (may already be in PlayerContracts.csv)")
        return
    
    # Combine and deduplicate contracts
    all_contracts = pl.concat(contracts_list, how="diagonal_relaxed")
    all_contracts = all_contracts.unique()
    
    # Save to file
    output_path = data_dir / "PlayerContracts.csv"
    all_contracts.write_csv(output_path)
    logger.info(f"  PlayerContracts: saved {len(all_contracts)} unique contract records")


def create_injury_data(data_dir: Path, injury_df: pl.DataFrame | None):
    """Save injury data to InjuryData.csv"""
    if injury_df is None or len(injury_df) == 0:
        logger.info("  No injury data found to extract (may already be in InjuryData.csv)")
        return
    
    output_path = data_dir / "InjuryData.csv"
    injury_df.write_csv(output_path)
    logger.info(f"  InjuryData: saved {len(injury_df)} records")


def create_snap_counts(data_dir: Path, snap_df: pl.DataFrame | None):
    """Save snap count data to SnapCounts.csv"""
    if snap_df is None or len(snap_df) == 0:
        logger.info("  No snap count data found to extract (may already be in SnapCounts.csv)")
        return
    
    # Rename playTime to a more appropriate column name if needed
    if "playTime" in snap_df.columns:
        snap_df = snap_df.rename({"playTime": "snapData"})
    
    output_path = data_dir / "SnapCounts.csv"
    snap_df.write_csv(output_path)
    logger.info(f"  SnapCounts: saved {len(snap_df)} records")


def main():
    print("=" * 60)
    print("NFL Data 3NF Normalizer")
    print("=" * 60)
    print()
    print("This script will normalize your data to 3NF:")
    print("  1. Extract contract data -> PlayerContracts.csv")
    print("  2. Extract injury data -> InjuryData.csv")
    print("  3. Extract snap counts -> SnapCounts.csv")
    print("  4. Remove player_name from TradeTable (use PlayerMapping)")
    print("  5. Deduplicate player data tables by primary keys")
    print()
    
    data_dir = Path("output")
    
    if not data_dir.exists():
        logger.error(f"Output directory not found: {data_dir}")
        return
    
    logger.info(f"Processing files in {data_dir.absolute()}/")
    logger.info("=" * 60)
    
    # Fix HistoricPlayerData
    historic_contracts = fix_historic_player_data(data_dir)
    
    # Fix WeeklyPlayerData
    weekly_contracts, injury_df, snap_df = fix_weekly_player_data(data_dir)
    
    # Fix TradeTable
    fix_trade_table(data_dir)
    
    # Create 3NF normalized tables
    create_player_contracts(data_dir, historic_contracts, weekly_contracts)
    create_injury_data(data_dir, injury_df)
    create_snap_counts(data_dir, snap_df)
    
    logger.info("=" * 60)
    logger.info("✓ 3NF normalization complete!")
    print()
    print("=" * 60)
    print("3NF Normalization Complete!")
    print("=" * 60)
    print()
    print("Database Schema (3NF):")
    print()
    print("Core Tables:")
    print("  - WeeklyPlayerData    PK: (playerID, week, year)")
    print("  - HistoricPlayerData  PK: (playerID, year)")
    print("  - WeeklyTeamData      PK: (teamID, week, year)")
    print()
    print("Reference Tables:")
    print("  - PlayerMapping       PK: (playerID)")
    print("  - TeamMapping         PK: (teamID)")
    print()
    print("Normalized Tables:")
    print("  - PlayerContracts     PK: (playerID, year, year_signed)")
    print("  - InjuryData          PK: (playerID, week, year)")
    print("  - SnapCounts          PK: (playerID, week, year)")
    print("  - TradeTable          PK: (trade_id)")


if __name__ == "__main__":
    main()

"""
Domain-Grounded Maritime Cost & Emissions Estimator (F-304 / 06_ml_engineering.md §1.2)
Calculates side-by-side financial and ESG impact for prescriptive actions:
- Container ship demurrage rates
- Cubic power-law bunker fuel consumption (slow-steaming)
- IMO VLSFO GHG emission conversion factors
"""

from typing import Dict, Any, Optional
from app.schemas.optimiser import CostImpactEstimate


class MaritimeCostEngine:
    # Industry benchmark hourly demurrage by vessel class ($/hour)
    DEMURRAGE_RATES: Dict[str, float] = {
        "FEEDER": 500.0,         # ~$12,000 / day
        "Feeder": 500.0,
        "PANAMAX": 1000.0,       # ~$24,000 / day
        "Panamax": 1000.0,
        "POST_PANAMAX": 1500.0,  # ~$36,000 / day
        "Post-Panamax": 1500.0,
        "ULTRA_LARGE": 2300.0,   # ~$55,200 / day
        "ULCV": 2300.0,
        "DEFAULT": 1041.67       # ~$25,000 / day
    }

    # Bunker fuel pricing and IMO emission standards
    VLSFO_PRICE_PER_MT = 650.0   # $ / metric tonne
    CO2_FACTOR_PER_MT_FUEL = 3.114  # mt CO2 / mt VLSFO burned
    STANDARD_CRUISE_SPEED_KTS = 18.0
    SLOW_STEAM_SPEED_KTS = 14.0

    @classmethod
    def calculate_demurrage_saving(
        cls,
        hours_saved: float,
        vessel_class: Optional[str] = None,
        is_priority: bool = False
    ) -> float:
        """
        Calculates demurrage cost avoided by reducing waiting or turnaround time.
        Priority cargo (reefers / expedited contracts) carries a 1.5x penalty multiplier.
        """
        v_cls_str = str(vessel_class or "DEFAULT").strip()
        v_norm = v_cls_str.upper().replace("-", "_").replace(" ", "_")
        if v_norm == "ULCV":
            v_norm = "ULTRA_LARGE"
        base_rate = cls.DEMURRAGE_RATES.get(v_norm, cls.DEMURRAGE_RATES.get(v_cls_str, cls.DEMURRAGE_RATES["DEFAULT"]))
        multiplier = 1.5 if is_priority else 1.0
        return round(hours_saved * base_rate * multiplier, 2)

    @classmethod
    def calculate_yard_congestion_damage(
        cls,
        dwell_delay_hours: float,
        teu_volume: float = 3000.0,
        current_utilization: float = 0.65
    ) -> float:
        """
        Calculates container yard (CY) congestion damage caused by delayed container clearance.
        When yard utilization > 80%, RTG reshuffling ('dead-digs') costs rise non-linearly.
        Above 88%, truck gate queues and berth idle costs compound.
        """
        if current_utilization < 0.75:
            return round(dwell_delay_hours * 120.0, 2)
        elif current_utilization < 0.88:
            active_teus = min(teu_volume, 3500.0)
            return round(dwell_delay_hours * (active_teus * 0.45), 2)
        else:
            active_teus = min(teu_volume, 5000.0)
            return round(dwell_delay_hours * (active_teus * 1.10), 2)

    @classmethod
    def calculate_contractual_laytime_demurrage(
        cls,
        wait_hours: float,
        dwell_hours: float,
        vessel_class: Optional[str] = None,
        is_priority: bool = False,
        laytime_grace_hours: Optional[float] = None
    ) -> float:
        """
        Contractual BIMCO Charterparty Laytime Demurrage:
        Grants standard laytime allowance (e.g. 12h Feeder, 18h Panamax, 24h ULCV).
        Demurrage billing accumulates on time exceeding agreed laytime.
        """
        v_cls_str = str(vessel_class or "DEFAULT").strip().upper()
        if laytime_grace_hours is None:
            if "FEEDER" in v_cls_str:
                laytime_grace_hours = 12.0
            elif "PANAMAX" in v_cls_str and "POST" not in v_cls_str:
                laytime_grace_hours = 18.0
            else:
                laytime_grace_hours = 24.0

        total_port_hours = wait_hours + dwell_hours
        excess_hours = max(0.0, total_port_hours - laytime_grace_hours)
        return cls.calculate_demurrage_saving(excess_hours, vessel_class, is_priority)

    @classmethod
    def calculate_slow_steam_impact(
        cls,
        transit_hours: float,
        speed_reduction_knots: float = 4.0
    ) -> Dict[str, float]:
        """
        Computes fuel and CO2 emissions saved via Admiralty cubic formula:
        F = k * v^3 * t
        Dropping from 18 to 14 knots reduces hourly fuel burn from ~3.65 mt/h to ~1.72 mt/h.
        """
        normal_speed = cls.STANDARD_CRUISE_SPEED_KTS
        reduced_speed = max(10.0, normal_speed - speed_reduction_knots)

        k_coefficient = 0.000625  # calibrated for 3.65 mt/h at 18 knots
        normal_burn_per_hour = k_coefficient * (normal_speed ** 3)
        reduced_burn_per_hour = k_coefficient * (reduced_speed ** 3)

        hourly_fuel_saved = max(0.0, normal_burn_per_hour - reduced_burn_per_hour)
        total_fuel_saved_mt = hourly_fuel_saved * transit_hours

        fuel_saved_usd = total_fuel_saved_mt * cls.VLSFO_PRICE_PER_MT
        co2_saved_mt = total_fuel_saved_mt * cls.CO2_FACTOR_PER_MT_FUEL

        return {
            "fuel_saved_mt": round(total_fuel_saved_mt, 2),
            "fuel_saved_usd": round(fuel_saved_usd, 2),
            "co2_saved_mt": round(co2_saved_mt, 2)
        }

    @classmethod
    def estimate_diversion_impact(
        cls,
        hours_saved: float,
        vessel_class: Optional[str] = None,
        is_priority: bool = False
    ) -> CostImpactEstimate:
        """
        Computes net economic benefit of diverting a vessel to an alternate compatible berth.
        Accounts for additional pilotage/tug fees (~$3,000) vs demurrage saved.
        """
        demurrage = cls.calculate_demurrage_saving(hours_saved, vessel_class, is_priority)
        operational_cost = 3200.0  # Additional maneuvering & pilotage
        net_benefit = demurrage - operational_cost

        return CostImpactEstimate(
            hours_saved=round(hours_saved, 1),
            demurrage_saved_usd=demurrage,
            bunker_fuel_saved_usd=0.0,
            co2_saved_mt=0.0,
            operational_cost_usd=operational_cost,
            net_benefit_usd=round(net_benefit, 2)
        )

    @classmethod
    def estimate_slow_steam_advisory(
        cls,
        delay_hours_absorbed: float,
        vessel_class: Optional[str] = None
    ) -> CostImpactEstimate:
        """
        Computes benefit of slow-steaming: avoids offshore idle demurrage AND saves bunker fuel.
        """
        demurrage = cls.calculate_demurrage_saving(delay_hours_absorbed, vessel_class)
        transit_window = max(12.0, delay_hours_absorbed * 2.5)
        fuel_impact = cls.calculate_slow_steam_impact(transit_window, speed_reduction_knots=3.5)

        net_benefit = demurrage + fuel_impact["fuel_saved_usd"]

        return CostImpactEstimate(
            hours_saved=round(delay_hours_absorbed, 1),
            demurrage_saved_usd=demurrage,
            bunker_fuel_saved_usd=fuel_impact["fuel_saved_usd"],
            co2_saved_mt=fuel_impact["co2_saved_mt"],
            operational_cost_usd=0.0,
            net_benefit_usd=round(net_benefit, 2)
        )

    @classmethod
    def estimate_resequence_impact(
        cls,
        hours_saved_priority_vessel: float,
        hours_delayed_lower_vessel: float
    ) -> CostImpactEstimate:
        """
        Computes net financial gain of bumping high-priority perishable cargo ahead of bulk cargo.
        """
        demurrage_saved = cls.calculate_demurrage_saving(
            hours_saved_priority_vessel, vessel_class="POST_PANAMAX", is_priority=True
        )
        demurrage_incurred = cls.calculate_demurrage_saving(
            hours_delayed_lower_vessel, vessel_class="FEEDER", is_priority=False
        )
        net_benefit = max(0.0, demurrage_saved - demurrage_incurred)

        return CostImpactEstimate(
            hours_saved=round(hours_saved_priority_vessel, 1),
            demurrage_saved_usd=demurrage_saved,
            bunker_fuel_saved_usd=0.0,
            co2_saved_mt=0.0,
            operational_cost_usd=800.0,  # Yard staging adjustment cost
            net_benefit_usd=round(net_benefit - 800.0, 2)
        )


cost_engine = MaritimeCostEngine()

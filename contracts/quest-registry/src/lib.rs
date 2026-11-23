//! SafroQuest QuestRegistry.
//!
//! Trust model: the game server verifies answers off-chain and is the only account ("oracle")
//! allowed to award XP. The contract enforces what must not depend on trust in the UI:
//! one claim per quest and player, levels computed on-chain, XP only goes up.
//!
//! STATUS: written for the V1 plan, NOT yet compiled or tested in the environment that generated
//! this repository. Run `cargo test` first, then an independent review before any real funds.

use cosmwasm_schema::{cw_serde, QueryResponses};
use cosmwasm_std::{
    entry_point, to_json_binary, Addr, Binary, Deps, DepsMut, Env, MessageInfo, Response, StdError, StdResult,
};
use cw_storage_plus::{Item, Map};

/// Must match `XP_PER_LEVEL` in packages/shared/src/ranks.ts.
pub const XP_PER_LEVEL: u64 = 50;
/// Upper bound per award, so a compromised oracle cannot mint unbounded XP in one call.
pub const MAX_XP_PER_AWARD: u64 = 200;
pub const MAX_BATCH: usize = 100;

#[cw_serde]
pub struct Config {
    pub admin: Addr,
    pub oracle: Addr,
}

#[cw_serde]
#[derive(Default)]
pub struct Player {
    pub xp: u64,
    pub level: u64,
}

#[cw_serde]
pub struct Award {
    pub player: String,
    pub quest_id: String,
    pub xp: u64,
}

#[cw_serde]
pub struct InstantiateMsg {
    pub admin: Option<String>,
    pub oracle: String,
}

#[cw_serde]
pub enum ExecuteMsg {
    /// Oracle only. Several awards in one transaction (cheaper than one transaction per answer).
    AwardBatch { awards: Vec<Award> },
    /// Admin only. Rotate the oracle key.
    UpdateOracle { oracle: String },
}

#[cw_serde]
#[derive(QueryResponses)]
pub enum QueryMsg {
    #[returns(Config)]
    Config {},
    #[returns(Player)]
    Player { addr: String },
    #[returns(bool)]
    Claimed { addr: String, quest_id: String },
}

const CONFIG: Item<Config> = Item::new("config");
const PLAYERS: Map<&Addr, Player> = Map::new("players");
const CLAIMED: Map<(&Addr, &str), bool> = Map::new("claimed");

fn err(msg: &str) -> StdError {
    StdError::generic_err(msg)
}

pub fn level_from_xp(xp: u64) -> u64 {
    xp / XP_PER_LEVEL + 1
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn instantiate(deps: DepsMut, _env: Env, info: MessageInfo, msg: InstantiateMsg) -> StdResult<Response> {
    let admin = match msg.admin {
        Some(a) => deps.api.addr_validate(&a)?,
        None => info.sender,
    };
    let oracle = deps.api.addr_validate(&msg.oracle)?;
    CONFIG.save(deps.storage, &Config { admin, oracle })?;
    Ok(Response::new().add_attribute("action", "instantiate"))
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn execute(deps: DepsMut, _env: Env, info: MessageInfo, msg: ExecuteMsg) -> StdResult<Response> {
    let cfg = CONFIG.load(deps.storage)?;
    match msg {
        ExecuteMsg::AwardBatch { awards } => {
            if info.sender != cfg.oracle {
                return Err(err("unauthorized"));
            }
            if awards.is_empty() || awards.len() > MAX_BATCH {
                return Err(err("invalid batch size"));
            }
            let mut applied = 0u64;
            for a in awards {
                if a.xp == 0 || a.xp > MAX_XP_PER_AWARD || a.quest_id.is_empty() || a.quest_id.len() > 64 {
                    return Err(err("invalid award"));
                }
                let addr = deps.api.addr_validate(&a.player)?;
                if CLAIMED.has(deps.storage, (&addr, a.quest_id.as_str())) {
                    continue; // already claimed: skip instead of failing the whole batch
                }
                CLAIMED.save(deps.storage, (&addr, a.quest_id.as_str()), &true)?;
                let mut p = PLAYERS.may_load(deps.storage, &addr)?.unwrap_or_default();
                p.xp = p.xp.checked_add(a.xp).ok_or_else(|| err("overflow"))?;
                p.level = level_from_xp(p.xp);
                PLAYERS.save(deps.storage, &addr, &p)?;
                applied += 1;
            }
            Ok(Response::new().add_attribute("action", "award_batch").add_attribute("applied", applied.to_string()))
        }
        ExecuteMsg::UpdateOracle { oracle } => {
            if info.sender != cfg.admin {
                return Err(err("unauthorized"));
            }
            let oracle = deps.api.addr_validate(&oracle)?;
            CONFIG.save(deps.storage, &Config { oracle: oracle.clone(), ..cfg })?;
            Ok(Response::new().add_attribute("action", "update_oracle").add_attribute("oracle", oracle))
        }
    }
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn query(deps: Deps, _env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::Config {} => to_json_binary(&CONFIG.load(deps.storage)?),
        QueryMsg::Player { addr } => {
            let a = deps.api.addr_validate(&addr)?;
            to_json_binary(&PLAYERS.may_load(deps.storage, &a)?.unwrap_or_default())
        }
        QueryMsg::Claimed { addr, quest_id } => {
            let a = deps.api.addr_validate(&addr)?;
            to_json_binary(&CLAIMED.has(deps.storage, (&a, quest_id.as_str())))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use cosmwasm_std::from_json;
    use cosmwasm_std::testing::{message_info, mock_dependencies, mock_env};

    fn award(p: &Addr, q: &str, xp: u64) -> Award {
        Award { player: p.to_string(), quest_id: q.to_string(), xp }
    }

    #[test]
    fn oracle_awards_once_per_quest_and_levels_up() {
        let mut deps = mock_dependencies();
        let admin = deps.api.addr_make("admin");
        let oracle = deps.api.addr_make("oracle");
        let player = deps.api.addr_make("player");
        instantiate(deps.as_mut(), mock_env(), message_info(&admin, &[]), InstantiateMsg { admin: None, oracle: oracle.to_string() }).unwrap();

        let batch = ExecuteMsg::AwardBatch { awards: vec![award(&player, "q-1", 20), award(&player, "q-1", 20), award(&player, "q-2", 40)] };
        let res = execute(deps.as_mut(), mock_env(), message_info(&oracle, &[]), batch).unwrap();
        assert_eq!(res.attributes[1].value, "2"); // the duplicate q-1 was skipped

        let p: Player = from_json(query(deps.as_ref(), mock_env(), QueryMsg::Player { addr: player.to_string() }).unwrap()).unwrap();
        assert_eq!(p.xp, 60);
        assert_eq!(p.level, 2);
        let c: bool = from_json(query(deps.as_ref(), mock_env(), QueryMsg::Claimed { addr: player.to_string(), quest_id: "q-1".into() }).unwrap()).unwrap();
        assert!(c);
    }

    #[test]
    fn only_the_oracle_can_award_and_only_the_admin_can_rotate() {
        let mut deps = mock_dependencies();
        let admin = deps.api.addr_make("admin");
        let oracle = deps.api.addr_make("oracle");
        let other = deps.api.addr_make("other");
        instantiate(deps.as_mut(), mock_env(), message_info(&admin, &[]), InstantiateMsg { admin: None, oracle: oracle.to_string() }).unwrap();

        let batch = ExecuteMsg::AwardBatch { awards: vec![award(&other, "q-1", 20)] };
        assert!(execute(deps.as_mut(), mock_env(), message_info(&other, &[]), batch).is_err());
        let rotate = ExecuteMsg::UpdateOracle { oracle: other.to_string() };
        assert!(execute(deps.as_mut(), mock_env(), message_info(&oracle, &[]), rotate.clone()).is_err());
        execute(deps.as_mut(), mock_env(), message_info(&admin, &[]), rotate).unwrap();
        let batch = ExecuteMsg::AwardBatch { awards: vec![award(&other, "q-1", 20)] };
        assert!(execute(deps.as_mut(), mock_env(), message_info(&other, &[]), batch).is_ok());
    }

    #[test]
    fn rejects_oversized_awards() {
        let mut deps = mock_dependencies();
        let admin = deps.api.addr_make("admin");
        let oracle = deps.api.addr_make("oracle");
        instantiate(deps.as_mut(), mock_env(), message_info(&admin, &[]), InstantiateMsg { admin: None, oracle: oracle.to_string() }).unwrap();
        let batch = ExecuteMsg::AwardBatch { awards: vec![award(&admin, "q-1", MAX_XP_PER_AWARD + 1)] };
        assert!(execute(deps.as_mut(), mock_env(), message_info(&oracle, &[]), batch).is_err());
    }
}

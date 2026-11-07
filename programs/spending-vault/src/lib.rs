use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

declare_id!("8A12uxD8G5fpV1tAJja61EB7fhUwksmaDwjGB9uqqGe6");

#[program]
pub mod spending_vault {
    use super::*;
    pub fn create(ctx: Context<Create>, task_id: [u8; 32], agent: Pubkey, recipient: Pubkey,
        total: u64, per_payment: u64, approval_above: u64, expires_at: i64) -> Result<()> {
        require!(total > 0 && per_payment <= total && approval_above <= per_payment, VaultError::Limit);
        require!(expires_at > Clock::get()?.unix_timestamp, VaultError::Expired);
        let task = &mut ctx.accounts.task;
        task.owner = ctx.accounts.owner.key(); task.agent = agent; task.recipient = recipient;
        task.mint = ctx.accounts.mint.key(); task.task_id = task_id;
        task.total = total; task.per_payment = per_payment; task.approval_above = approval_above;
        task.expires_at = expires_at; task.spent = 0; task.version = 1; task.revoked = false;
        task.bump = ctx.bumps.task;
        Ok(())
    }
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        token::transfer_checked(CpiContext::new(ctx.accounts.token_program.to_account_info(), TransferChecked {
            from: ctx.accounts.source.to_account_info(), to: ctx.accounts.vault.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(), authority: ctx.accounts.owner.to_account_info(),
        }), amount, ctx.accounts.mint.decimals)
    }
    pub fn grant_exception(ctx: Context<GrantException>, purchase_id: [u8; 32], amount: u64,
        scope: [u8; 32], version: u32) -> Result<()> {
        let task = &ctx.accounts.task;
        validate(task, amount, version, Clock::get()?.unix_timestamp)?;
        let e = &mut ctx.accounts.exception;
        e.task = task.key(); e.purchase_id = purchase_id; e.amount = amount;
        e.scope = scope; e.version = version;
        Ok(())
    }
    pub fn purchase(ctx: Context<Purchase>, purchase_id: [u8; 32], amount: u64,
        scope: [u8; 32], version: u32) -> Result<()> {
        let task = &mut ctx.accounts.task;
        validate(task, amount, version, Clock::get()?.unix_timestamp)?;
        if amount > task.approval_above {
            let e = ctx.accounts.exception.as_ref().ok_or(VaultError::Approval)?;
            require!(e.task == task.key() && e.purchase_id == purchase_id && e.amount == amount
                && e.scope == scope && e.version == version, VaultError::Approval);
        }
        task.spent = task.spent.checked_add(amount).ok_or(VaultError::Limit)?;
        let owner = task.owner; let task_id = task.task_id; let bump = [task.bump];
        let seeds: &[&[u8]] = &[b"task", owner.as_ref(), task_id.as_ref(), &bump];
        token::transfer_checked(CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), TransferChecked {
            from: ctx.accounts.vault.to_account_info(), to: ctx.accounts.recipient.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(), authority: task.to_account_info(),
        }, &[seeds]), amount, ctx.accounts.mint.decimals)?;
        let receipt = &mut ctx.accounts.receipt;
        receipt.task = task.key(); receipt.purchase_id = purchase_id; receipt.amount = amount;
        receipt.scope = scope; receipt.version = version;
        Ok(())
    }
    pub fn revoke(ctx: Context<OwnerTask>) -> Result<()> { ctx.accounts.task.revoked = true; Ok(()) }
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        let task = &ctx.accounts.task; let bump = [task.bump];
        let seeds: &[&[u8]] = &[b"task", task.owner.as_ref(), task.task_id.as_ref(), &bump];
        token::transfer_checked(CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), TransferChecked {
            from: ctx.accounts.vault.to_account_info(), to: ctx.accounts.destination.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(), authority: task.to_account_info(),
        }, &[seeds]), amount, ctx.accounts.mint.decimals)
    }
}

fn validate(task: &TaskPolicy, amount: u64, version: u32, now: i64) -> Result<()> {
    require!(!task.revoked, VaultError::Revoked);
    require!(now < task.expires_at, VaultError::Expired);
    require!(version == task.version, VaultError::Version);
    require!(amount > 0 && amount <= task.per_payment
        && task.spent.checked_add(amount).map_or(false, |s| s <= task.total), VaultError::Limit);
    Ok(())
}

#[derive(Accounts)]
#[instruction(task_id: [u8;32])]
pub struct Create<'info> {
    #[account(mut)] pub owner: Signer<'info>,
    #[account(init, payer=owner, space=8+TaskPolicy::INIT_SPACE, seeds=[b"task",owner.key().as_ref(),task_id.as_ref()], bump)]
    pub task: Account<'info, TaskPolicy>,
    pub mint: Account<'info, Mint>,
    #[account(init, payer=owner, seeds=[b"vault",task.key().as_ref()], bump, token::mint=mint, token::authority=task)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>, pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct Deposit<'info> {
    pub owner: Signer<'info>,
    #[account(has_one=owner, has_one=mint)] pub task: Account<'info, TaskPolicy>,
    pub mint: Account<'info, Mint>,
    #[account(mut, token::mint=mint, token::authority=owner)] pub source: Account<'info, TokenAccount>,
    #[account(mut, seeds=[b"vault",task.key().as_ref()], bump, token::mint=mint, token::authority=task)]
    pub vault: Account<'info, TokenAccount>, pub token_program: Program<'info, Token>,
}
#[derive(Accounts)]
#[instruction(purchase_id: [u8;32])]
pub struct GrantException<'info> {
    #[account(mut)] pub owner: Signer<'info>,
    #[account(has_one=owner)] pub task: Account<'info, TaskPolicy>,
    #[account(init, payer=owner, space=8+ScopedException::INIT_SPACE, seeds=[b"exception",task.key().as_ref(),purchase_id.as_ref()], bump)]
    pub exception: Account<'info, ScopedException>, pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
#[instruction(purchase_id: [u8;32])]
pub struct Purchase<'info> {
    #[account(mut)] pub agent: Signer<'info>,
    #[account(mut, has_one=agent, has_one=mint, seeds=[b"task",task.owner.as_ref(),task.task_id.as_ref()], bump=task.bump)]
    pub task: Account<'info, TaskPolicy>,
    pub mint: Account<'info, Mint>,
    #[account(mut, seeds=[b"vault",task.key().as_ref()], bump, token::mint=mint, token::authority=task)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, token::mint=mint, constraint=recipient.owner == task.recipient @ VaultError::Recipient)]
    pub recipient: Account<'info, TokenAccount>,
    #[account(init, payer=agent, space=8+PurchaseReceipt::INIT_SPACE, seeds=[b"purchase",task.key().as_ref(),purchase_id.as_ref()], bump)]
    pub receipt: Account<'info, PurchaseReceipt>,
    pub exception: Option<Account<'info, ScopedException>>,
    pub token_program: Program<'info, Token>, pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct OwnerTask<'info> {
    pub owner: Signer<'info>, #[account(mut,has_one=owner)] pub task: Account<'info, TaskPolicy>,
}
#[derive(Accounts)]
pub struct Withdraw<'info> {
    pub owner: Signer<'info>, #[account(has_one=owner,has_one=mint)] pub task: Account<'info, TaskPolicy>,
    pub mint: Account<'info, Mint>,
    #[account(mut,seeds=[b"vault",task.key().as_ref()],bump,token::mint=mint,token::authority=task)] pub vault: Account<'info,TokenAccount>,
    #[account(mut,token::mint=mint,token::authority=owner)] pub destination: Account<'info,TokenAccount>,
    pub token_program: Program<'info,Token>,
}
#[account]
#[derive(InitSpace)]
pub struct TaskPolicy {
    pub owner: Pubkey, pub agent: Pubkey, pub recipient: Pubkey, pub mint: Pubkey,
    pub task_id: [u8;32], pub total: u64, pub per_payment: u64, pub approval_above: u64,
    pub expires_at: i64, pub spent: u64, pub version: u32, pub revoked: bool, pub bump: u8,
}
#[account]
#[derive(InitSpace)]
pub struct ScopedException { pub task: Pubkey, pub purchase_id: [u8;32], pub amount: u64, pub scope: [u8;32], pub version: u32 }
#[account]
#[derive(InitSpace)]
pub struct PurchaseReceipt { pub task: Pubkey, pub purchase_id: [u8;32], pub amount: u64, pub scope: [u8;32], pub version: u32 }
#[error_code]
pub enum VaultError {
    #[msg("Allowance or per-payment limit exceeded")] Limit,
    #[msg("Task expired")] Expired,
    #[msg("Spending authority revoked")] Revoked,
    #[msg("Wrong policy version")] Version,
    #[msg("Exact owner approval required")] Approval,
    #[msg("Recipient not approved")] Recipient,
}

#[cfg(test)]
mod tests {
    use super::*;
    fn policy() -> TaskPolicy {
        TaskPolicy { owner:Pubkey::new_unique(),agent:Pubkey::new_unique(),recipient:Pubkey::new_unique(),mint:Pubkey::new_unique(),
            task_id:[1;32],total:100,per_payment:60,approval_above:30,expires_at:1000,spent:0,version:1,revoked:false,bump:255 }
    }
    #[test]
    fn expiry_is_rechecked_at_purchase_time() {
        let p=policy();assert!(validate(&p,20,1,999).is_ok());assert!(validate(&p,20,1,1000).is_err());
    }
    #[test]
    fn counters_cannot_wrap_or_exceed_the_allowance() {
        let mut p=policy();p.spent=90;assert!(validate(&p,11,1,100).is_err());
        p.spent=u64::MAX;p.total=u64::MAX;assert!(validate(&p,1,1,100).is_err());
    }
    #[test]
    fn version_revocation_and_hard_limits_are_independent() {
        let mut p=policy();assert!(validate(&p,61,1,100).is_err());assert!(validate(&p,20,2,100).is_err());
        p.revoked=true;assert!(validate(&p,1,1,100).is_err());
    }
}

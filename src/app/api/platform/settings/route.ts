import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

/**
 * GET /api/platform/settings
 * Public endpoint to fetch the platform brand logo and details for landing page & top navigation.
 */
export async function GET() {
  try {
    // 1. Look for the Master Platform Owner tenant
    let platformTenant = await prisma.tenant.findUnique({
      where: { subdomain: 'platform-admin' },
      select: {
        id: true,
        name: true,
        alias: true,
        logoUrl: true,
      },
    });

    // 2. Check if a logo is saved in the Setting table for Platform Logo
    const platformLogoSetting = await prisma.setting.findFirst({
      where: {
        param: { in: ['Platform Logo', 'platform_logo', 'School Logo', 'logoUrl'] },
      },
      orderBy: { updatedAt: 'desc' },
    });

    let logoUrl = platformTenant?.logoUrl || platformLogoSetting?.value || null;
    let platformName = platformTenant?.name || 'SMS Global Cloud';

    // 3. Fallback: If no platform logo is set yet, check if any active tenant/owner has uploaded a logo
    if (!logoUrl) {
      const tenantWithLogo = await prisma.tenant.findFirst({
        where: {
          logoUrl: {
            not: null,
          },
        },
        orderBy: { updatedAt: 'desc' },
        select: { logoUrl: true, name: true },
      });

      if (tenantWithLogo?.logoUrl) {
        logoUrl = tenantWithLogo.logoUrl;
      }
    }

    return NextResponse.json({
      success: true,
      logoUrl: logoUrl || null,
      platformName: platformTenant?.name || 'SMS Global Cloud',
      alias: platformTenant?.alias || 'SMS',
    });
  } catch (error: any) {
    console.error('Error fetching platform settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch platform settings', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/platform/settings
 * Super Admin / Platform Owner endpoint to update platform branding & logo.
 */
export async function PUT(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const session = token ? verifyToken(token) : null;

    if (!session || session.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Super Admin / Platform Owner privileges required.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { logoUrl, platformName } = body;

    // Ensure master platform tenant exists and update it
    let masterTenant = await prisma.tenant.findUnique({
      where: { subdomain: 'platform-admin' },
    });

    if (!masterTenant) {
      masterTenant = await prisma.tenant.create({
        data: {
          name: platformName?.trim() || 'SMS Global Platform Headquarters',
          alias: 'HQ',
          subdomain: 'platform-admin',
          logoUrl: logoUrl ? logoUrl.trim() : null,
          currency: 'GHS',
          plan: 'ENTERPRISE',
          studentLimit: 999999,
          status: 'ACTIVE',
        },
      });
    } else {
      masterTenant = await prisma.tenant.update({
        where: { id: masterTenant.id },
        data: {
          ...(logoUrl !== undefined ? { logoUrl: logoUrl ? logoUrl.trim() : null } : {}),
          ...(platformName ? { name: platformName.trim() } : {}),
        },
      });
    }

    // Also persist in Setting model for redundancy
    if (logoUrl !== undefined) {
      await prisma.setting.upsert({
        where: {
          tenantId_param: {
            tenantId: masterTenant.id,
            param: 'Platform Logo',
          },
        },
        update: { value: logoUrl ? logoUrl.trim() : '', category: 'General' },
        create: {
          tenantId: masterTenant.id,
          param: 'Platform Logo',
          value: logoUrl ? logoUrl.trim() : '',
          category: 'General',
        },
      });
    }

    return NextResponse.json({
      success: true,
      logoUrl: masterTenant.logoUrl,
      platformName: masterTenant.name,
      message: 'Platform logo and branding updated successfully.',
    });
  } catch (error: any) {
    console.error('Error updating platform settings:', error);
    return NextResponse.json(
      { error: 'Failed to update platform settings', details: error.message },
      { status: 500 }
    );
  }
}

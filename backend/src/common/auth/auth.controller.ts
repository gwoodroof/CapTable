import { Controller, Post, Get, Body, HttpCode, Query, Redirect, Req, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';

class RegisterDto {
  email!: string;
  password!: string;
  name!: string;
  companyName!: string;
}

class LoginDto {
  email!: string;
  password!: string;
}

class GoogleAuthDto {
  credential!: string;
}

class GoogleRegisterDto {
  credential!: string;
  companyName!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @HttpCode(202)
  async register(@Body() body: RegisterDto) {
    await this.authService.register(body.email, body.password, body.name ?? '', body.companyName);
    return { message: 'Verification email sent. Please check your inbox to complete signup.' };
  }

  @Get('verify-email')
  @Redirect()
  async verifyEmail(@Query('token') token: string) {
    const jwtToken = await this.authService.verifyEmail(token);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return { url: `${frontendUrl}/auth/verified?token=${jwtToken}`, statusCode: 302 };
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: LoginDto) {
    const token = await this.authService.login(body.email, body.password);
    return { token };
  }

  @Post('google')
  @HttpCode(200)
  async googleAuth(@Body() body: GoogleAuthDto) {
    return this.authService.googleAuth(body.credential);
  }

  @Post('google/register')
  async googleRegister(@Body() body: GoogleRegisterDto) {
    const token = await this.authService.googleRegister(body.credential, body.companyName);
    return { token };
  }

  @Post('switch-company')
  @HttpCode(200)
  async switchCompany(@Body() body: { tenantId: string }, @Req() req: Request) {
    if (!req.user) throw new UnauthorizedException('Authentication required');
    const token = await this.authService.switchCompany(req.user.sub, req.user.email, req.user.name ?? '', body.tenantId);
    return { token };
  }
}

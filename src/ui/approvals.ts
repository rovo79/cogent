import * as vscode from 'vscode';
import { ApprovalHandler, ApprovalRequest } from '../agent/execution/execManager';

export const askApproval: ApprovalHandler = async (request: ApprovalRequest): Promise<boolean> => {
    const detailSections = [request.reason];
    if (request.preview) {
        detailSections.push('', request.preview);
    }

    const selection = await vscode.window.showInformationMessage(
        `Cogent requires approval (${request.risk})`,
        {
            modal: true,
            detail: detailSections.join('\n'),
        },
        'Approve',
        'Reject'
    );

    return selection === 'Approve';
};

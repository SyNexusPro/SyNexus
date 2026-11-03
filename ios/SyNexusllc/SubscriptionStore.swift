import Foundation
import RevenueCat

@MainActor
final class SubscriptionStore: ObservableObject {
    @Published private(set) var customerInfo: CustomerInfo?
    @Published private(set) var currentOffering: Offering?
    @Published private(set) var isConfigured = false
    @Published var errorMessage: String?

    var isPro: Bool { customerInfo?.hasSyNexusPro == true }

    var lifetimePackage: Package? { currentOffering?.lifetimePackage }
    var yearlyPackage: Package? { currentOffering?.yearlyPackage }
    var monthlyPackage: Package? { currentOffering?.monthlyPackage }

    func apply(_ info: CustomerInfo) {
        customerInfo = info
        errorMessage = nil
    }

    func configure() {
        SubscriptionConstants.configurePurchases()
        isConfigured = Purchases.isConfigured
        if !isConfigured {
            errorMessage = "RevenueCat API key is missing."
        }
    }

    func startListening() async {
        configure()
        guard Purchases.isConfigured else { return }
        await refresh()
        for await info in Purchases.shared.customerInfoStream {
            customerInfo = info
        }
    }

    func refresh() async {
        guard Purchases.isConfigured else { return }
        do {
            async let info = Purchases.shared.customerInfo()
            async let offerings = Purchases.shared.offerings()
            customerInfo = try await info
            currentOffering = try await offerings.current
            errorMessage = nil
        } catch {
            present(error)
        }
    }

    func purchase(_ package: Package) async {
        guard Purchases.isConfigured else { return }
        do {
            let result = try await Purchases.shared.purchase(package: package)
            if result.userCancelled { return }
            customerInfo = result.customerInfo
            errorMessage = nil
        } catch {
            present(error)
        }
    }

    func restore() async {
        guard Purchases.isConfigured else { return }
        do {
            customerInfo = try await Purchases.shared.restorePurchases()
            errorMessage = nil
        } catch {
            present(error)
        }
    }

    private func present(_ error: Error) {
        if let code = error as? ErrorCode, code == .purchaseCancelledError {
            return
        }
        errorMessage = error.localizedDescription
    }
}

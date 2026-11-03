import Foundation
import RevenueCat

enum SubscriptionConstants {
    static let entitlementID = "synexusllc_pro"
    static let lifetimeProductID = "lifetime"
    static let yearlyProductID = "yearly"
    static let monthlyProductID = "monthly"

    static var apiKey: String {
        (Bundle.main.object(forInfoDictionaryKey: "REVENUECAT_API_KEY") as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    }

    static func configurePurchases() {
        guard !Purchases.isConfigured else { return }
        let key = apiKey
        guard !key.isEmpty else { return }
        Purchases.logLevel = .debug
        Purchases.configure(withAPIKey: key)
    }
}

extension Offering {
    var lifetimePackage: Package? {
        package(identifier: SubscriptionConstants.lifetimeProductID)
            ?? availablePackages.first { $0.packageType == .lifetime }
    }

    var yearlyPackage: Package? {
        package(identifier: SubscriptionConstants.yearlyProductID)
            ?? annual
            ?? availablePackages.first { $0.packageType == .annual }
    }

    var monthlyPackage: Package? {
        package(identifier: SubscriptionConstants.monthlyProductID)
            ?? monthly
            ?? availablePackages.first { $0.packageType == .monthly }
    }
}

extension CustomerInfo {
    var hasSyNexusPro: Bool {
        entitlements[SubscriptionConstants.entitlementID]?.isActive == true
    }

    var synexusProProductID: String? {
        entitlements[SubscriptionConstants.entitlementID]?.productIdentifier
    }
}
